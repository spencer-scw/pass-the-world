import type { SqlValue } from '../platform';
import type { Env, Game, GameStatus, OrderMode } from '../types';
import { HttpError } from '../util';
import { all, first, run, runOnce } from './sql';
import { errors } from '../copy/errors';

export async function getGame(env: Env, gameId: string): Promise<Game> {
  const game = await first<Game>(env, 'SELECT * FROM games WHERE id = ?', gameId);
  if (!game) throw new HttpError(404, errors.gameNotFound);
  return game;
}

export const findGameByInviteCode = (env: Env, inviteCode: string) =>
  first<Game>(env, 'SELECT * FROM games WHERE invite_code = ?', inviteCode);

/** A game plus the requesting user's membership in it. */
export type GameForUser = Game & { role: 'admin' | 'player'; active: number };

export const listGamesForUser = (env: Env, userId: string, opts: { includeFinished: boolean }) =>
  all<GameForUser>(
    env,
    `SELECT g.*, gp.role, gp.active FROM games g JOIN game_players gp ON gp.game_id = g.id
     WHERE gp.user_id = ? ${opts.includeFinished ? '' : "AND g.status != 'finished'"}
     ORDER BY g.created_at DESC`,
    userId,
  );

export interface NewGame {
  id: string;
  name: string;
  ownerId: string;
  worldName: string;
  playerName: string;
  turnMinutes: number;
  orderMode: OrderMode;
  startWindowHours: number | null;
  discordWebhookUrl: string | null;
  inviteCode: string;
}

/** Creates a game with its owner as the first player and an admin. */
export const insertGameWithOwner = (env: Env, g: NewGame, now: number) =>
  env.db.batch([
    {
      sql: `INSERT INTO games (
              id, name, owner_id, world_name, player_name, turn_minutes, order_mode,
              start_window_hours, discord_webhook_url, invite_code, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        g.id,
        g.name,
        g.ownerId,
        g.worldName,
        g.playerName,
        g.turnMinutes,
        g.orderMode,
        g.startWindowHours,
        g.discordWebhookUrl,
        g.inviteCode,
        now,
      ],
    },
    {
      sql: `INSERT INTO game_players (game_id, user_id, position, role, joined_at) VALUES (?, ?, 0, 'admin', ?)`,
      args: [g.id, g.ownerId, now],
    },
  ]);

export interface GamePatch {
  name?: string;
  worldName?: string;
  playerName?: string;
  turnMinutes?: number;
  orderMode?: OrderMode;
  startWindowHours?: number | null;
  discordWebhookUrl?: string | null;
  status?: GameStatus;
}

// Whitelist: patch keys → columns. Never build column names from user input.
const PATCH_COLUMNS: Record<keyof GamePatch, string> = {
  name: 'name',
  worldName: 'world_name',
  playerName: 'player_name',
  turnMinutes: 'turn_minutes',
  orderMode: 'order_mode',
  startWindowHours: 'start_window_hours',
  discordWebhookUrl: 'discord_webhook_url',
  status: 'status',
};

/** Updates only the fields present in the patch. */
export async function updateGame(env: Env, gameId: string, patch: GamePatch): Promise<void> {
  const entries = (Object.keys(PATCH_COLUMNS) as (keyof GamePatch)[])
    .filter((k) => patch[k] !== undefined)
    .map((k) => [PATCH_COLUMNS[k], (patch[k] ?? null) as SqlValue] as const);
  if (entries.length === 0) return;
  await run(
    env,
    `UPDATE games SET ${entries.map(([col]) => `${col} = ?`).join(', ')} WHERE id = ?`,
    ...entries.map(([, v]) => v),
    gameId,
  );
}

export const setInviteCode = (env: Env, gameId: string, inviteCode: string) =>
  run(env, 'UPDATE games SET invite_code = ? WHERE id = ?', inviteCode, gameId);

/** Sets the save the next turn starts from. */
export const setHeadSnapshot = (env: Env, gameId: string, snapshotId: string) =>
  run(env, 'UPDATE games SET head_snapshot_id = ? WHERE id = ?', snapshotId, gameId);

/** setup → running. False if the game had already started. */
export const markGameStarted = (env: Env, gameId: string) =>
  runOnce(env, `UPDATE games SET status = 'running' WHERE id = ? AND status = 'setup'`, gameId);
