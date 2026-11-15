// The only things that differ between hosts. Cloudflare implements these with D1 + R2
// (src/cloudflare), the self-hosted Node server with SQLite + the local filesystem (src/node).

export type SqlValue = string | number | null;

/** SQLite-flavoured database. Both D1 and node:sqlite speak the same SQL, so migrations are shared. */
export interface Database {
  first<T>(sql: string, ...args: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, ...args: SqlValue[]): Promise<T[]>;
  /** Returns the number of rows changed (used for compare-and-set state transitions). */
  run(sql: string, ...args: SqlValue[]): Promise<number>;
  /** Runs statements atomically. */
  batch(statements: { sql: string; args: SqlValue[] }[]): Promise<void>;
}

/** Key/value storage for save bundles. */
export interface BlobStore {
  put(key: string, data: ArrayBuffer, metadata: Record<string, string>): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
}

export interface Config {
  environment: string; // "dev" enables /api/auth/dev-login
  siteUrl: string; // where the website is served, e.g. https://ptw.example.com
  apiUrl: string; // public URL of the API, e.g. https://ptw.example.com/api
  maxSnapshotMb: number;
  discordClientId?: string;
  discordClientSecret?: string;
}

/** Everything a request handler needs. Passed to Hono as `c.env`. */
export interface Env {
  db: Database;
  blobs: BlobStore;
  config: Config;
}

/** Builds config from string env vars. Same variable names on every host. */
export function configFromVars(vars: Record<string, string | undefined>): Config {
  const publicUrl = vars.PUBLIC_URL?.replace(/\/$/, '');
  const siteUrl = (vars.SITE_URL ?? publicUrl ?? 'http://localhost:5173').replace(/\/$/, '');
  return {
    environment: vars.ENVIRONMENT ?? 'production',
    siteUrl,
    apiUrl: (vars.API_URL ?? (publicUrl ? `${publicUrl}/api` : `${siteUrl}/api`)).replace(/\/$/, ''),
    maxSnapshotMb: Number(vars.MAX_SNAPSHOT_MB ?? '64'),
    discordClientId: vars.DISCORD_CLIENT_ID || undefined,
    discordClientSecret: vars.DISCORD_CLIENT_SECRET || undefined,
  };
}
