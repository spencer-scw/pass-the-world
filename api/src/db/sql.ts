// Low-level query helpers. Only modules inside db/ should import this; everything else
// calls the named functions exported from db/index.ts.
import type { SqlValue } from '../platform';
import type { Env } from '../types';

export const first = <T>(env: Env, sql: string, ...args: SqlValue[]) => env.db.first<T>(sql, ...args);

export const all = <T>(env: Env, sql: string, ...args: SqlValue[]) => env.db.all<T>(sql, ...args);

/** Runs a statement and returns how many rows it changed. */
export const run = (env: Env, sql: string, ...args: SqlValue[]) => env.db.run(sql, ...args);

/** For compare-and-set updates: true if exactly one row changed. */
export const runOnce = async (env: Env, sql: string, ...args: SqlValue[]) => (await run(env, sql, ...args)) === 1;
