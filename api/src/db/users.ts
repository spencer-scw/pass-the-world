import type { Env, User } from '../types';
import { newId } from '../util';
import { first, run } from './sql';

export const getUserById = (env: Env, userId: string) =>
  first<User>(env, 'SELECT id, display_name, discord_id FROM users WHERE id = ?', userId);

/** Creates the user on first Discord sign-in, refreshes their display name after that. Returns the user ID. */
export async function upsertDiscordUser(
  env: Env,
  discordId: string,
  displayName: string,
  now: number,
): Promise<string> {
  const row = await first<{ id: string }>(
    env,
    `INSERT INTO users (id, display_name, discord_id, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (discord_id) DO UPDATE SET display_name = excluded.display_name
     RETURNING id`,
    newId(),
    displayName,
    discordId,
    now,
  );
  return row!.id;
}

/** Dev login: name-only accounts (no Discord). Returns the user ID. */
export async function findOrCreateDevUser(env: Env, name: string, now: number): Promise<string> {
  const existing = await first<{ id: string }>(
    env,
    'SELECT id FROM users WHERE display_name = ? AND discord_id IS NULL',
    name,
  );
  if (existing) return existing.id;
  const id = newId();
  await run(env, 'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)', id, name, now);
  return id;
}
