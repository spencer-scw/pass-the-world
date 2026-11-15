import type { Env, Snapshot } from '../types';
import { HttpError } from '../util';
import { all, first, run } from './sql';
import { errors } from '../copy/errors';

export async function getSnapshot(env: Env, gameId: string, snapshotId: string): Promise<Snapshot> {
  const s = await first<Snapshot>(env, 'SELECT * FROM snapshots WHERE id = ? AND game_id = ?', snapshotId, gameId);
  if (!s) throw new HttpError(404, errors.snapshotNotFound);
  return s;
}

export const latestCheckpoint = (env: Env, turnId: string) =>
  first<Snapshot>(
    env,
    `SELECT * FROM snapshots WHERE turn_id = ? AND kind = 'checkpoint' ORDER BY created_at DESC LIMIT 1`,
    turnId,
  );

export const listSnapshots = (env: Env, gameId: string, limit: number) =>
  all<Snapshot>(env, 'SELECT * FROM snapshots WHERE game_id = ? ORDER BY created_at DESC LIMIT ?', gameId, limit);

export const insertSnapshot = (env: Env, s: Snapshot) =>
  run(
    env,
    `INSERT INTO snapshots (id, game_id, turn_id, kind, sha256, size, r2_key, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.game_id,
    s.turn_id,
    s.kind,
    s.sha256,
    s.size,
    s.r2_key,
    s.uploaded_by,
    s.created_at,
  );
