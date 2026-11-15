// Cloudflare Workers host: D1 for the database, R2 for save bundles.
// The website is served by Workers Static Assets (see [assets] in wrangler.toml); only /api/* reaches this code.
import { Hono } from 'hono';
import { api, sweep } from '../app';
import { configFromVars, type BlobStore, type Database, type Env, type SqlValue } from '../platform';

interface Bindings {
  DB: D1Database;
  SAVES: R2Bucket;
  [key: string]: unknown;
}

class D1Store implements Database {
  constructor(private d1: D1Database) {}
  first<T>(sql: string, ...args: SqlValue[]) {
    return this.d1
      .prepare(sql)
      .bind(...args)
      .first<T>();
  }
  async all<T>(sql: string, ...args: SqlValue[]) {
    return (
      await this.d1
        .prepare(sql)
        .bind(...args)
        .all<T>()
    ).results;
  }
  async run(sql: string, ...args: SqlValue[]) {
    return (
      await this.d1
        .prepare(sql)
        .bind(...args)
        .run()
    ).meta.changes;
  }
  async batch(statements: { sql: string; args: SqlValue[] }[]) {
    await this.d1.batch(statements.map((s) => this.d1.prepare(s.sql).bind(...s.args)));
  }
}

class R2Store implements BlobStore {
  constructor(private bucket: R2Bucket) {}
  async put(key: string, data: ArrayBuffer, metadata: Record<string, string>) {
    await this.bucket.put(key, data, { httpMetadata: { contentType: 'application/zip' }, customMetadata: metadata });
  }
  async get(key: string) {
    return (await this.bucket.get(key))?.body ?? null;
  }
}

const services = (b: Bindings): Env => ({
  db: new D1Store(b.DB),
  blobs: new R2Store(b.SAVES),
  config: configFromVars(b as unknown as Record<string, string | undefined>),
});

const root = new Hono<{ Bindings: Env }>().route('/api', api);

export default {
  fetch: (req, env, ctx) => root.fetch(req, services(env), ctx),
  scheduled: (_event, env, ctx) => ctx.waitUntil(sweep(services(env), Date.now())),
} satisfies ExportedHandler<Bindings>;
