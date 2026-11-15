import type { Env, User } from '../types';
import { first, run } from './sql';

export const getUserBySessionHash = (env: Env, tokenHash: string) =>
  first<User>(
    env,
    'SELECT u.id, u.display_name, u.discord_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
    tokenHash,
  );

export const insertSession = (env: Env, tokenHash: string, userId: string, kind: 'web' | 'mod', now: number) =>
  run(
    env,
    'INSERT INTO sessions (token_hash, user_id, kind, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)',
    tokenHash,
    userId,
    kind,
    now,
    now,
  );

export const touchSession = (env: Env, tokenHash: string, now: number) =>
  run(env, 'UPDATE sessions SET last_used_at = ? WHERE token_hash = ?', now, tokenHash);

export const deleteSession = (env: Env, tokenHash: string) =>
  run(env, 'DELETE FROM sessions WHERE token_hash = ?', tokenHash);
