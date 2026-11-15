import type { RotationPlayer } from '../rotation';
import type { Env, GamePlayer } from '../types';
import { HttpError } from '../util';
import { all, first, run } from './sql';
import { errors } from '../copy/errors';

/** The user's membership in a game. 404s (rather than 403s) so non-members can't probe for game IDs. */
export async function getMembership(env: Env, gameId: string, userId: string): Promise<GamePlayer> {
  const m = await first<GamePlayer>(
    env,
    'SELECT * FROM game_players WHERE game_id = ? AND user_id = ?',
    gameId,
    userId,
  );
  if (!m) throw new HttpError(404, errors.gameNotFound);
  return m;
}

export async function requireAdmin(env: Env, gameId: string, userId: string): Promise<GamePlayer> {
  const m = await getMembership(env, gameId, userId);
  if (m.role !== 'admin') throw new HttpError(403, errors.adminOnly);
  return m;
}

export type PlayerWithName = GamePlayer & { display_name: string };

export const listPlayersWithNames = (env: Env, gameId: string) =>
  all<PlayerWithName>(
    env,
    `SELECT gp.*, u.display_name
     FROM game_players gp
     JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = ?
     ORDER BY gp.position`,
    gameId,
  );

export async function rotationPlayers(env: Env, gameId: string): Promise<RotationPlayer[]> {
  const rows = await all<GamePlayer>(env, 'SELECT * FROM game_players WHERE game_id = ?', gameId);
  return rows.map((r) => ({ userId: r.user_id, position: r.position, active: r.active === 1 }));
}

/** Adds the user at the end of the turn order. No-op if they're already in the game. */
export const addPlayer = (env: Env, gameId: string, userId: string, now: number) =>
  run(
    env,
    `INSERT INTO game_players (game_id, user_id, position, joined_at)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM game_players WHERE game_id = ?), ?)
     ON CONFLICT DO NOTHING`,
    gameId,
    userId,
    gameId,
    now,
  );

/** Rewrites positions so userIds[0] goes first. */
export const setPlayerOrder = (env: Env, gameId: string, userIds: string[]) =>
  env.db.batch(
    userIds.map((uid, i) => ({
      sql: 'UPDATE game_players SET position = ? WHERE game_id = ? AND user_id = ?',
      args: [i, gameId, uid],
    })),
  );

export const setPlayerActive = (env: Env, gameId: string, userId: string, active: boolean) =>
  run(env, 'UPDATE game_players SET active = ? WHERE game_id = ? AND user_id = ?', active ? 1 : 0, gameId, userId);

export const setPlayerRole = (env: Env, gameId: string, userId: string, role: 'admin' | 'player') =>
  run(env, 'UPDATE game_players SET role = ? WHERE game_id = ? AND user_id = ?', role, gameId, userId);
