// Turns the OpenAPI spec's component schemas into C# records for the mod.
//
// Supports what our zod schemas produce: objects, string enums, literals, arrays, $refs,
// allOf (an extended schema), anyOf of objects (a union, flattened into one record),
// and OpenAPI 3.1 nullability (`type: ['string', 'null']`).
//
// Records get a `Dto` suffix so they never collide with Terraria types (e.g. Terraria.Player).
// String enums become static classes of constants (e.g. TurnStatus.Waiting == "waiting").

type Schema = {
  $ref?: string;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
};

interface Property {
  name: string;
  schema: Schema;
  required: boolean;
  description?: string;
}

interface ObjectShape {
  description?: string;
  properties: Property[];
}

const pascal = (s: string) => s.replace(/(^|[_\-\s]+)([a-zA-Z0-9])/g, (_, __, c: string) => c.toUpperCase());

const types = (s: Schema): string[] => (s.type === undefined ? [] : Array.isArray(s.type) ? s.type : [s.type]);

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generateCSharp(schemas: Record<string, Schema>, namespace: string, header: string): string {
  const refName = (ref: string) => ref.replace('#/components/schemas/', '');
  const deref = (s: Schema): Schema => (s.$ref ? deref(schemas[refName(s.$ref)]) : s);
  const isStringEnum = (s: Schema) => types(s).includes('string') && Array.isArray(s.enum) && s.enum.length > 1;
  // Nullable refs come out as `allOf: [{ $ref }, { type: ['object', 'null'] }]`.
  const isNullable = (s: Schema) =>
    types(s).includes('null') ||
    [...(s.anyOf ?? s.oneOf ?? []), ...(s.allOf ?? [])].some((v) => types(v).includes('null'));
  /** Parts of an allOf that add something (as opposed to a description or nullability marker). */
  const substantiveParts = (parts: Schema[]) => parts.filter((p) => p.$ref || p.properties || p.items || p.allOf);

  /** Flattens objects, allOf and anyOf/oneOf unions into one list of properties. */
  function shapeOf(schema: Schema): ObjectShape {
    const s = deref(schema);
    if (s.allOf) {
      const parts = substantiveParts(s.allOf).map(shapeOf);
      const byName = new Map<string, Property>();
      for (const part of parts)
        for (const p of part.properties)
          byName.set(p.name, { ...p, required: byName.get(p.name)?.required || p.required });
      return {
        description: s.description ?? parts.find((p) => p.description)?.description,
        properties: [...byName.values()],
      };
    }
    const variants = s.anyOf ?? s.oneOf;
    if (variants) {
      const shapes = variants.filter((v) => !types(v).includes('null')).map(shapeOf);
      const byName = new Map<string, Property>();
      for (const shape of shapes)
        for (const p of shape.properties) {
          const inAll = shapes.every((other) => other.properties.some((q) => q.name === p.name && q.required));
          const existing = byName.get(p.name);
          // The same property with different literal values across variants (a discriminator) is just a string.
          const schema =
            existing && JSON.stringify(existing.schema) !== JSON.stringify(p.schema) ? { type: 'string' } : p.schema;
          byName.set(p.name, { ...p, schema, required: inAll });
        }
      return { description: s.description, properties: [...byName.values()] };
    }
    const required = new Set(s.required ?? []);
    return {
      description: s.description,
      properties: Object.entries(s.properties ?? {}).map(([name, prop]) => ({
        name,
        schema: prop,
        required: required.has(name),
        description: prop.description ?? deref(prop).description,
      })),
    };
  }

  const records: string[] = [];
  const emitted = new Set<string>();

  /** The C# type for a schema, without nullability. Emits nested records for inline objects. */
  function typeOf(schema: Schema, contextName: string): string {
    if (schema.$ref) {
      const name = refName(schema.$ref);
      const target = schemas[name];
      if (isStringEnum(target)) return 'string';
      if (target.properties || target.allOf || target.anyOf || target.oneOf) return emitRecord(name);
      return typeOf(target, name);
    }
    // allOf of one $ref plus description/nullability parts is just that ref.
    if (schema.allOf) {
      const substantive = substantiveParts(schema.allOf);
      if (substantive.length === 1 && substantive[0].$ref) return typeOf(substantive[0], contextName);
      return emitRecord(contextName, schema);
    }
    if (schema.anyOf || schema.oneOf) {
      const nonNull = (schema.anyOf ?? schema.oneOf)!.filter((v) => !types(v).includes('null'));
      if (nonNull.length === 1) return typeOf(nonNull[0], contextName);
      return emitRecord(contextName, schema);
    }
    const t = types(schema).filter((x) => x !== 'null');
    if (t.includes('array')) return `List<${typeOf(schema.items ?? {}, `${contextName}Item`)}>`;
    if (t.includes('object') || schema.properties) return emitRecord(contextName, schema);
    if (t.includes('integer')) return schema.format === 'int64' ? 'long' : 'int';
    if (t.includes('number')) return 'double';
    if (t.includes('boolean')) return 'bool';
    if (t.includes('string')) return 'string';
    return 'System.Text.Json.JsonElement';
  }

  /** Emits `{name}Dto` once and returns its type name. */
  function emitRecord(name: string, inline?: Schema): string {
    const typeName = `${pascal(name)}Dto`;
    if (emitted.has(typeName)) return typeName;
    emitted.add(typeName);

    const shape = shapeOf(inline ?? schemas[name]);
    const params = shape.properties.map((p) => {
      const base = typeOf(p.schema, `${pascal(name)}${pascal(p.name)}`);
      const optional = !p.required || isNullable(p.schema);
      return { ...p, csName: pascal(p.name), csType: optional ? `${base}?` : base };
    });

    const lines: string[] = [];
    if (shape.description) lines.push(`/// <summary>${xml(shape.description)}</summary>`);
    for (const p of params)
      if (p.description) lines.push(`/// <param name="${p.csName}">${xml(p.description)}</param>`);
    if (params.length === 0) lines.push(`public sealed record ${typeName}();`);
    else {
      lines.push(`public sealed record ${typeName}(`);
      lines.push(params.map((p) => `    ${p.csType} ${p.csName}`).join(',\n') + ');');
    }
    records.push(lines.join('\n'));
    return typeName;
  }

  const enums: string[] = [];
  for (const name of Object.keys(schemas).sort()) {
    const schema = schemas[name];
    if (isStringEnum(schema)) {
      const lines = [];
      lines.push(`/// <summary>${xml(schema.description ?? `Values of ${name}.`)}</summary>`);
      lines.push(`public static class ${pascal(name)}`, '{');
      for (const value of schema.enum as string[]) lines.push(`    public const string ${pascal(value)} = "${value}";`);
      lines.push('}');
      enums.push(lines.join('\n'));
    } else {
      emitRecord(name);
    }
  }

  return [
    header,
    '#nullable enable',
    'using System.Collections.Generic;',
    '',
    `namespace ${namespace};`,
    '',
    [...enums, ...records].join('\n\n'),
    '',
  ].join('\n');
}
