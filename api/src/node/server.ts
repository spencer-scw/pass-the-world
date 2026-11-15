// Self-hosted Node server: SQLite + local files. Serves the website and the API from one port.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Hono } from 'hono';
import { api, sweep } from '../app';
import { configFromVars, type Env } from '../platform';
import { FsBlobStore } from './fs-blobs';
import { SqliteStore } from './sqlite';

const port = Number(process.env.PORT ?? 8787);
const dataDir = resolve(process.env.DATA_DIR ?? './data');
const siteDir = resolve(process.env.SITE_DIR ?? '../site/dist');
const migrationsDir = resolve(process.env.MIGRATIONS_DIR ?? './migrations');

mkdirSync(dataDir, { recursive: true });
const db = new SqliteStore(join(dataDir, 'pass-the-world.sqlite'));
db.migrate(migrationsDir);

const env: Env = {
  db,
  blobs: new FsBlobStore(join(dataDir, 'saves')),
  config: configFromVars(process.env),
};

const root = new Hono<{ Bindings: Env }>();
root.route('/api', api);
// serveStatic resolves `root` against the working directory, so pass it relative.
root.use('/*', serveStatic({ root: relative(process.cwd(), siteDir) || '.' }));

serve({ fetch: (req) => root.fetch(req, env), port }, () => {
  console.log(`Pass the World listening on :${port} (site ${env.config.siteUrl}, data ${dataDir})`);
});

// Same job Cloudflare runs on a cron trigger.
const runSweep = () => sweep(env, Date.now()).catch((err) => console.error('sweep failed', err));
runSweep();
setInterval(runSweep, 5 * 60_000);
