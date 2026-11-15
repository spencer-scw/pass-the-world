import { createRoute, z } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { authRoutes } from './auth';
import { errors } from './copy/errors';
import { gameRoutes } from './games';
import { BEARER_AUTH, createRouter, formatIssues, jsonResponse } from './openapi';
import { turnRoutes } from './turns';
import { HttpError } from './util';

export { sweep } from './turns';

/** Host-agnostic API. Each host mounts it at /api and serves the website at /. */
export const api = createRouter();

// Only matters when the site is hosted on a different origin than the API (e.g. Vite dev server).
api.use('*', (c, next) =>
  cors({
    origin: new URL(c.env.config.siteUrl).origin,
    allowHeaders: ['Authorization', 'Content-Type', 'X-Content-SHA256'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Content-SHA256'],
    maxAge: 86400,
  })(c, next),
);

api.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  if (err instanceof ZodError) return c.json({ error: formatIssues(err.issues) }, 400);
  console.error(err);
  return c.json({ error: errors.internal }, 500);
});

api.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: 'Health check',
    description: 'For load balancers and the Docker healthcheck.',
    responses: { 200: jsonResponse(z.object({ ok: z.literal(true) }), 'The server is up.') },
  }),
  (c) => c.json({ ok: true as const }, 200),
);

api.route('/', authRoutes);
api.route('/', gameRoutes);
api.route('/', turnRoutes);

// ---- OpenAPI spec and reference docs ----

api.openAPIRegistry.registerComponent('securitySchemes', BEARER_AUTH, {
  type: 'http',
  scheme: 'bearer',
  description:
    'A session token. The website gets one from Discord sign-in; the mod gets one through the /device link flow.',
});

export const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Pass the World API',
    version: '0.1.0',
    description:
      'Backend for Pass the World: players take turns with one shared Terraria world and character. ' +
      'Used by the website and the tModLoader mod. Times are Unix epoch milliseconds.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth', description: 'Website sign-in and sessions.' },
    { name: 'Mod linking', description: 'Linking the tModLoader mod to an account with a short code.' },
    { name: 'Games', description: 'Creating and managing games.' },
    { name: 'Players', description: 'Invites, turn order and player settings.' },
    { name: 'Turns', description: 'Claiming, playing and skipping turns.' },
    { name: 'Saves', description: 'Uploading, downloading and rolling back save bundles.' },
    { name: 'System', description: 'Operational endpoints.' },
  ],
};

api.doc31('/openapi.json', openApiConfig);
api.get('/docs', Scalar({ url: '/api/openapi.json', pageTitle: 'Pass the World API' }));
