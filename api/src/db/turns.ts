// Turn queries. The mark* functions are compare-and-set transitions: each only applies if the
// turn is still in the expected state and returns false otherwise, so concurrent requests and
// the sweep can never both advance the same turn.
import type { Env, Turn } from '../types';
import { HttpError } from '../util';
import { all, first, run, runOnce } from './sql';
import { errors } from '../copy/errors';

export async function getTurn(env: Env, turnId: string): Promise<Turn> {
  const turn = await first<Turn>(env, 'SELECT * FROM turns WHERE id = ?', turnId);
  if (!turn) throw new HttpError(404, errors.turnNotFound);
  return turn;
}

/** The game's open turn (waiting or active), if any. There is at most one. */
export const currentTurn = (env: Env, gameId: string) =>
  first<Turn>(
    env,
    `SELECT * FROM turns WHERE game_id = ? AND status IN ('waiting', 'active') ORDER BY seq DESC LIMIT 1`,
    gameId,
  );

export const waitingTurn = (env: Env, gameId: string) =>
  first<Turn>(env, `SELECT * FROM turns WHERE game_id = ? AND status = 'waiting'`, gameId);

/**
 * The most recent turn assigned to someone, played or not (optionally only before a given seq).
 * Strict rotation continues from here.
 */
export const lastAssignedTurn = (env: Env, gameId: string, beforeSeq = Number.MAX_SAFE_INTEGER) =>
  first<Turn>(
    env,
    'SELECT * FROM turns WHERE game_id = ? AND user_id IS NOT NULL AND seq < ? ORDER BY seq DESC LIMIT 1',
    gameId,
    beforeSeq,
  );

/** The most recent turn someone actually played. Open order uses this for "no back-to-back turns". */
export const lastPlayedTurn = (env: Env, gameId: string) =>
  first<Turn>(
    env,
    `SELECT *
     FROM turns
     WHERE game_id = ? AND user_id IS NOT NULL AND status IN ('active', 'completed', 'expired')
     ORDER BY seq DESC
     LIMIT 1`,
    gameId,
  );

export async function nextTurnSeq(env: Env, gameId: string): Promise<number> {
  const row = await first<{ seq: number | null }>(env, 'SELECT MAX(seq) AS seq FROM turns WHERE game_id = ?', gameId);
  return (row?.seq ?? 0) + 1;
}

export type TurnWithName = Turn & { display_name: string | null };

export const listTurnsWithNames = (env: Env, gameId: string, limit: number) =>
  all<TurnWithName>(
    env,
    `SELECT t.*, u.display_name
     FROM turns t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.game_id = ?
     ORDER BY t.seq DESC
     LIMIT ?`,
    gameId,
    limit,
  );

export type OpenTurnForSweep = Turn & { start_window_hours: number | null; order_mode: string };

/** Waiting/active turns in running games, with the game settings the sweep needs. */
export const listOpenTurnsInRunningGames = (env: Env) =>
  all<OpenTurnForSweep>(
    env,
    `SELECT t.*, g.start_window_hours, g.order_mode FROM turns t JOIN games g ON g.id = t.game_id
     WHERE t.status IN ('waiting', 'active') AND g.status = 'running'`,
  );

export const insertWaitingTurn = (
  env: Env,
  t: Pick<Turn, 'id' | 'game_id' | 'seq' | 'user_id' | 'base_snapshot_id' | 'available_at'>,
) =>
  run(
    env,
    `INSERT INTO turns (id, game_id, seq, user_id, status, base_snapshot_id, available_at)
     VALUES (?, ?, ?, ?, 'waiting', ?, ?)`,
    t.id,
    t.game_id,
    t.seq,
    t.user_id,
    t.base_snapshot_id,
    t.available_at,
  );

// ---- Transitions (compare-and-set) ----

/** waiting → active, owned by userId, with the clock started. */
export const markTurnClaimed = (env: Env, turnId: string, userId: string, now: number, deadlineAt: number) =>
  runOnce(
    env,
    `UPDATE turns SET status = 'active', user_id = ?, claimed_at = ?, deadline_at = ?, last_heartbeat_at = ?
     WHERE id = ? AND status = 'waiting'`,
    userId,
    now,
    deadlineAt,
    now,
    turnId,
  );

/** active → completed with the final upload. */
export const markTurnCompleted = (env: Env, turnId: string, resultSnapshotId: string, now: number) =>
  runOnce(
    env,
    `UPDATE turns SET status = 'completed', result_snapshot_id = ?, ended_at = ? WHERE id = ? AND status = 'active'`,
    resultSnapshotId,
    now,
    turnId,
  );

/** active → expired, keeping the last checkpoint (if any) as the result. */
export const markTurnExpired = (env: Env, turnId: string, resultSnapshotId: string | null, now: number) =>
  runOnce(
    env,
    `UPDATE turns SET status = 'expired', result_snapshot_id = ?, ended_at = ? WHERE id = ? AND status = 'active'`,
    resultSnapshotId,
    now,
    turnId,
  );

/** waiting/active → skipped, discarding any progress. */
export const markTurnSkipped = (env: Env, turnId: string, now: number) =>
  runOnce(
    env,
    `UPDATE turns SET status = 'skipped', ended_at = ? WHERE id = ? AND status IN ('waiting', 'active')`,
    now,
    turnId,
  );

// ---- Updates to waiting/active turns ----

export const touchHeartbeat = (env: Env, turnId: string, now: number) =>
  run(env, 'UPDATE turns SET last_heartbeat_at = ? WHERE id = ?', now, turnId);

/** Hands a waiting turn to someone else (null = up for grabs) and restarts its start window. */
export const reassignWaitingTurnOwner = (env: Env, turnId: string, userId: string | null, now: number) =>
  run(env, `UPDATE turns SET user_id = ?, available_at = ? WHERE id = ? AND status = 'waiting'`, userId, now, turnId);

/** Restarts the start window of the game's waiting turn (e.g. after unpausing). */
export const resetWaitingTurnWindow = (env: Env, gameId: string, now: number) =>
  run(env, `UPDATE turns SET available_at = ? WHERE game_id = ? AND status = 'waiting'`, now, gameId);

/** Makes the game's waiting turn unclaimed (switching to open order). */
export const clearWaitingTurnOwner = (env: Env, gameId: string) =>
  run(env, `UPDATE turns SET user_id = NULL WHERE game_id = ? AND status = 'waiting'`, gameId);

/** Points a waiting turn at a different starting save (rollback). */
export const setWaitingTurnBase = (env: Env, turnId: string, snapshotId: string) =>
  run(env, `UPDATE turns SET base_snapshot_id = ? WHERE id = ? AND status = 'waiting'`, snapshotId, turnId);
