// Helpers for declaring routes with @hono/zod-openapi.
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { ErrorSchema } from './schemas';
import { requireUser } from './session';
import type { AppEnv } from './types';

export const formatIssues = (issues: readonly { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.map(String).join('.') || 'body'}: ${i.message}`).join('; ');

/** A router whose validation failures come back in the API's usual `{ error }` shape. */
export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: formatIssues(result.error.issues) }, 400);
    },
  });

export const BEARER_AUTH = 'bearerAuth';

/** Spread into a route for endpoints that need a signed-in user. */
export const signedIn = {
  security: [{ [BEARER_AUTH]: [] as string[] }],
  middleware: requireUser,
};

export const jsonResponse = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});

export const zipBody = {
  required: true,
  description: 'A save bundle zip. Send its hex SHA-256 in the X-Content-SHA256 header to detect corruption.',
  content: { 'application/zip': { schema: z.string().openapi({ format: 'binary' }) } },
};

export const zipResponse = {
  description: 'The save bundle zip. Its hex SHA-256 is in the X-Content-SHA256 header.',
  content: { 'application/zip': { schema: z.string().openapi({ format: 'binary' }) } },
};

export const redirectResponse = (description: string) => ({ description });

const errorResponses = {
  400: jsonResponse(ErrorSchema, 'The request was invalid.'),
  401: jsonResponse(ErrorSchema, 'Missing or expired token.'),
  403: jsonResponse(ErrorSchema, 'Signed in, but not allowed to do this.'),
  404: jsonResponse(ErrorSchema, "Not found, or you're not a member of this game."),
  409: jsonResponse(ErrorSchema, "Conflicts with the game or turn's current state."),
  410: jsonResponse(ErrorSchema, 'No longer available.'),
  413: jsonResponse(ErrorSchema, 'Upload is too large.'),
  500: jsonResponse(ErrorSchema, 'Server misconfiguration or bug.'),
  502: jsonResponse(ErrorSchema, 'An upstream service (Discord) failed.'),
};

/** The documented error responses for a route. */
export function errorsFor<K extends keyof typeof errorResponses>(...codes: K[]): Pick<typeof errorResponses, K> {
  return Object.fromEntries(codes.map((code) => [code, errorResponses[code]])) as Pick<typeof errorResponses, K>;
}
