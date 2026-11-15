import type { Env, Snapshot, SnapshotKind } from './types';
import { insertSnapshot } from './db';
import { HttpError, newId, sha256Hex } from './util';
import { errors } from './copy/errors';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

/**
 * Reads a save bundle (zip) from the request body, verifies it, stores it in R2 and records it.
 * The mod sends X-Content-SHA256 so we can detect corruption in transit.
 */
export async function storeSnapshot(
  env: Env,
  req: Request,
  opts: { gameId: string; turnId: string | null; kind: SnapshotKind; userId: string },
): Promise<Snapshot> {
  const maxBytes = env.config.maxSnapshotMb * 1024 * 1024;
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, errors.saveTooLarge(env.config.maxSnapshotMb));

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) throw new HttpError(400, errors.emptyUpload);
  if (body.byteLength > maxBytes) throw new HttpError(413, errors.saveTooLarge(env.config.maxSnapshotMb));
  const head = new Uint8Array(body, 0, 4);
  if (!ZIP_MAGIC.every((b, i) => head[i] === b)) throw new HttpError(400, errors.notASaveBundle);

  const sha256 = await sha256Hex(body);
  const claimed = req.headers.get('X-Content-SHA256');
  if (claimed && claimed.toLowerCase() !== sha256) throw new HttpError(400, errors.uploadCorrupted);

  const snapshot: Snapshot = {
    id: newId(),
    game_id: opts.gameId,
    turn_id: opts.turnId,
    kind: opts.kind,
    sha256,
    size: body.byteLength,
    r2_key: '',
    uploaded_by: opts.userId,
    created_at: Date.now(),
  };
  snapshot.r2_key = `games/${opts.gameId}/snapshots/${snapshot.id}.zip`;

  await env.blobs.put(snapshot.r2_key, body, { sha256, kind: opts.kind });
  await insertSnapshot(env, snapshot);
  return snapshot;
}

export const snapshotInfo = (s: Snapshot) => ({
  id: s.id,
  sha256: s.sha256,
  size: s.size,
  kind: s.kind,
  createdAt: s.created_at,
});
