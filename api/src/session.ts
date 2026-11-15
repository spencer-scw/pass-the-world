import type { MiddlewareHandler } from 'hono';
import { errors } from './copy/errors';
import { getUserBySessionHash, insertSession, touchSession } from './db';
import type { AppEnv, Env } from './types';
import { HttpError, randomToken, sha256Hex } from './util';

/** Requires `Authorization: Bearer <token>` and sets `c.get('user')`. */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, errors.notSignedIn);

  const hash = await sha256Hex(header.slice('Bearer '.length));
  const user = await getUserBySessionHash(c.env, hash);
  if (!user) throw new HttpError(401, errors.sessionExpired);

  c.set('user', user);
  await touchSession(c.env, hash, Date.now());
  await next();
};

/** Issues a new bearer token. Only its hash is stored. */
export async function createSession(env: Env, userId: string, kind: 'web' | 'mod'): Promise<string> {
  const token = randomToken();
  await insertSession(env, await sha256Hex(token), userId, kind, Date.now());
  return token;
}
