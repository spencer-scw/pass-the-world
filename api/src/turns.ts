import { createRoute } from '@hono/zod-openapi';
import type { Env, Game, Turn } from './types';
import {
  currentTurn,
  getGame,
  getMembership,
  getSnapshot,
  getTurn,
  insertWaitingTurn,
  lastAssignedTurn,
  lastPlayedTurn,
  latestCheckpoint,
  listOpenTurnsInRunningGames,
  markTurnClaimed,
  markTurnCompleted,
  markTurnExpired,
  markTurnSkipped,
  nextTurnSeq,
  reassignWaitingTurnOwner,
  rotationPlayers,
  setHeadSnapshot,
  touchHeartbeat,
  waitingTurn,
} from './db';
import { notifications, type ExpireReason, type SkipReason } from './copy/notifications';
import { mention, notify } from './notify';
import {
  canClaimOpenTurn,
  isPastGrace,
  isStartWindowMissed,
  nextStrictPlayer,
  turnDeadline,
  UPLOAD_GRACE_MS,
} from './rotation';
import { createRouter, errorsFor, jsonResponse, signedIn, zipBody } from './openapi';
import { ClaimSchema, HeartbeatSchema, TurnIdParam, UploadedSchema } from './schemas';
import { snapshotInfo, storeSnapshot } from './storage';
import { HttpError, newId } from './util';
import { errors } from './copy/errors';

// ---------------------------------------------------------------------------
// Turn lifecycle
//
//   waiting ──claim──▶ active ──finish──▶ completed
//      │                 │
//      │                 ├─ deadline + grace passes ─▶ expired (keeps last checkpoint, if any)
//      │                 └─ admin skip ─▶ skipped / expired
//      └─ start window missed (strict) or admin skip ─▶ skipped
//
// Every exit from waiting/active creates the next waiting turn. Transitions use the
// compare-and-set mark* functions in db/turns.ts, so concurrent requests and the
// sweep can never both advance the same turn.
// ---------------------------------------------------------------------------

export function turnSummary(t: Turn, userName: string | null) {
  return {
    id: t.id,
    seq: t.seq,
    status: t.status,
    userId: t.user_id,
    userName,
    availableAt: t.available_at,
    claimedAt: t.claimed_at,
    deadlineAt: t.deadline_at,
    endedAt: t.ended_at,
  };
}

/** Creates the next waiting turn from the game's current head snapshot. */
export async function createNextTurn(env: Env, gameId: string, now: number): Promise<Turn | null> {
  const game = await getGame(env, gameId); // re-read: head may have just changed
  if (game.status !== 'running' || !game.head_snapshot_id) return null;

  const players = await rotationPlayers(env, gameId);
  if (!players.some((p) => p.active)) return null;

  const last = await lastAssignedTurn(env, gameId);
  const seq = await nextTurnSeq(env, gameId);
  const userId = game.order_mode === 'strict' ? nextStrictPlayer(players, last?.user_id ?? null) : null;

  const turn: Turn = {
    id: newId(),
    game_id: gameId,
    seq,
    user_id: userId,
    status: 'waiting',
    base_snapshot_id: game.head_snapshot_id,
    result_snapshot_id: null,
    available_at: now,
    claimed_at: null,
    deadline_at: null,
    last_heartbeat_at: null,
    ended_at: null,
  };
  await insertWaitingTurn(env, turn);

  const autoSkips = game.order_mode === 'strict' && game.start_window_hours != null;
  await notify(
    env,
    game,
    notifications.turnAvailable({
      seq,
      player: userId ? await mention(env, userId) : null,
      startBy: autoSkips ? now + game.start_window_hours! * 3_600_000 : null,
    }),
  );
  return turn;
}

/** In strict mode, re-pick who the waiting turn belongs to (after reordering or deactivating players). */
export async function reassignWaitingTurn(env: Env, game: Game): Promise<void> {
  if (game.order_mode !== 'strict') return;
  const waiting = await waitingTurn(env, game.id);
  if (!waiting) return;
  const prev = await lastAssignedTurn(env, game.id, waiting.seq);
  const next = nextStrictPlayer(await rotationPlayers(env, game.id), prev?.user_id ?? null);
  if (next !== waiting.user_id) {
    await reassignWaitingTurnOwner(env, waiting.id, next, Date.now());
    if (next) await notify(env, game, notifications.turnReassigned({ player: await mention(env, next) }));
  }
}

/** Ends an active turn without a final upload, keeping the latest checkpoint if there is one. */
export async function expireTurn(env: Env, turn: Turn, now: number, reason: ExpireReason): Promise<boolean> {
  const checkpoint = await latestCheckpoint(env, turn.id);
  if (!(await markTurnExpired(env, turn.id, checkpoint?.id ?? null, now))) return false;
  if (checkpoint) await setHeadSnapshot(env, turn.game_id, checkpoint.id);

  const game = await getGame(env, turn.game_id);
  const player = await mention(env, turn.user_id);
  await notify(
    env,
    game,
    notifications.turnExpired({ seq: turn.seq, player, reason, keptCheckpoint: checkpoint != null }),
  );
  await createNextTurn(env, turn.game_id, now);
  return true;
}

/** Ends a waiting or active turn, discarding any progress. */
export async function skipTurn(env: Env, turn: Turn, now: number, reason: SkipReason): Promise<boolean> {
  if (!(await markTurnSkipped(env, turn.id, now))) return false;
  const game = await getGame(env, turn.game_id);
  await notify(
    env,
    game,
    notifications.turnSkipped({ seq: turn.seq, player: await mention(env, turn.user_id), reason }),
  );
  await createNextTurn(env, turn.game_id, now);
  return true;
}

/**
 * Closes the open turn of a game that was just finished, and announces the end. An active turn keeps its latest
 * checkpoint (the mod's next heartbeat sends the player back to the menu); a waiting turn is simply closed.
 * Call after the game's status is set, so no next turn gets opened.
 */
export async function closeFinishedGame(env: Env, gameId: string, now: number): Promise<void> {
  const turn = await currentTurn(env, gameId);
  let interrupted: { seq: number; player: string; keptCheckpoint: boolean } | null = null;
  if (turn?.status === 'active') {
    const checkpoint = await latestCheckpoint(env, turn.id);
    if (await markTurnExpired(env, turn.id, checkpoint?.id ?? null, now)) {
      if (checkpoint) await setHeadSnapshot(env, gameId, checkpoint.id);
      interrupted = { seq: turn.seq, player: await mention(env, turn.user_id), keptCheckpoint: checkpoint != null };
    }
  } else if (turn?.status === 'waiting') {
    await markTurnSkipped(env, turn.id, now);
  }
  await notify(env, await getGame(env, gameId), notifications.gameFinished({ interrupted }));
}

/** Cron: expire overdue turns and skip no-shows. */
export async function sweep(env: Env, now: number): Promise<void> {
  for (const t of await listOpenTurnsInRunningGames(env)) {
    if (t.status === 'active' && t.deadline_at != null && isPastGrace(t.deadline_at, now)) {
      await expireTurn(env, t, now, 'timeout');
    } else if (
      t.status === 'waiting' &&
      t.order_mode === 'strict' &&
      isStartWindowMissed(t.available_at, t.start_window_hours, now)
    ) {
      await skipTurn(env, t, now, { kind: 'no-show', hours: t.start_window_hours! });
    }
  }
}

// ---------------------------------------------------------------------------
// Routes used by the mod
// ---------------------------------------------------------------------------

export const turnRoutes = createRouter();

async function requireOwnActiveTurn(env: Env, turnId: string, userId: string, now: number): Promise<Turn> {
  const turn = await getTurn(env, turnId);
  if (turn.user_id !== userId) throw new HttpError(403, errors.notYourTurn);
  if (turn.status !== 'active') throw new HttpError(409, errors.turnInStatus(turn.status));
  if (isPastGrace(turn.deadline_at!, now)) throw new HttpError(409, errors.turnExpired);
  return turn;
}

turnRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/turns/{id}/claim',
    tags: ['Turns'],
    summary: 'Start or resume a turn',
    description:
      'Starts a waiting turn, or resumes your own active one (after a crash, quit or PC switch). Requires a player ' +
      "in the rotation and a running game. Strict order: only the turn's owner can claim. Open order: anyone except " +
      "whoever played last. Claiming starts the wall clock; resuming doesn't pause or reset it.",
    ...signedIn,
    request: { params: TurnIdParam },
    responses: {
      200: jsonResponse(ClaimSchema, 'The turn, its deadline, and which save to download.'),
      ...errorsFor(401, 403, 404, 409),
    },
  }),
  async (c) => {
    const me = c.get('user');
    const now = Date.now();
    let turn = await getTurn(c.env, c.req.valid('param').id);
    const game = await getGame(c.env, turn.game_id);
    const membership = await getMembership(c.env, game.id, me.id);
    if (!membership.active) throw new HttpError(403, errors.notInRotation);
    if (game.status !== 'running') throw new HttpError(409, errors.gameNotRunning(game.status));

    let resumed = false;
    if (turn.status === 'active') {
      if (turn.user_id !== me.id) throw new HttpError(409, errors.someoneElsePlaying);
      if (isPastGrace(turn.deadline_at!, now)) throw new HttpError(409, errors.turnExpired);
      resumed = true;
    } else if (turn.status === 'waiting') {
      if (game.order_mode === 'strict' && turn.user_id !== me.id) throw new HttpError(403, errors.notYourTurnYet);
      if (game.order_mode === 'open') {
        const last = await lastPlayedTurn(c.env, game.id);
        if (!canClaimOpenTurn(await rotationPlayers(c.env, game.id), last?.user_id ?? null, me.id))
          throw new HttpError(403, errors.tookLastTurn);
      }
      const deadline = turnDeadline(now, game.turn_minutes);
      if (!(await markTurnClaimed(c.env, turn.id, me.id, now, deadline)))
        throw new HttpError(409, errors.someoneElseClaimed);
      turn = await getTurn(c.env, turn.id);
      await notify(
        c.env,
        game,
        notifications.turnStarted({ seq: turn.seq, player: await mention(c.env, me.id), deadlineAt: deadline }),
      );
    } else {
      throw new HttpError(409, errors.turnAlreadyInStatus(turn.status));
    }

    // Resume from this turn's latest checkpoint if there is one, otherwise from where the turn started.
    const snapshot =
      (resumed && (await latestCheckpoint(c.env, turn.id))) ||
      (await getSnapshot(c.env, game.id, turn.base_snapshot_id));

    return c.json(
      {
        gameId: game.id,
        turn: turnSummary(turn, me.display_name),
        deadlineAt: turn.deadline_at!,
        graceMs: UPLOAD_GRACE_MS,
        serverNow: now,
        snapshot: snapshotInfo(snapshot),
        resumed,
      },
      200,
    );
  },
);

turnRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/turns/{id}/heartbeat',
    tags: ['Turns'],
    summary: 'Heartbeat while playing',
    description:
      "The mod calls this every minute while the turn's player is in the world, and uses the reply to resync its " +
      'countdown. A 403/409 means the turn was skipped or expired; the mod then leaves the world without saving.',
    ...signedIn,
    request: { params: TurnIdParam },
    responses: {
      200: jsonResponse(HeartbeatSchema, 'Current deadline and server time.'),
      ...errorsFor(401, 403, 404, 409),
    },
  }),
  async (c) => {
    const now = Date.now();
    const turn = await requireOwnActiveTurn(c.env, c.req.valid('param').id, c.get('user').id, now);
    await touchHeartbeat(c.env, turn.id, now);
    return c.json({ deadlineAt: turn.deadline_at!, serverNow: now }, 200);
  },
);

turnRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/turns/{id}/checkpoint',
    tags: ['Saves'],
    summary: 'Upload a checkpoint',
    description:
      "A mid-turn save. If the turn expires without a final upload, its latest checkpoint is kept. Only the turn's " +
      'player, while active and until the deadline plus grace.',
    ...signedIn,
    request: { params: TurnIdParam, body: zipBody },
    responses: { 200: jsonResponse(UploadedSchema, 'Stored.'), ...errorsFor(400, 401, 403, 404, 409, 413) },
  }),
  async (c) => {
    const me = c.get('user');
    const turn = await requireOwnActiveTurn(c.env, c.req.valid('param').id, me.id, Date.now());
    const snap = await storeSnapshot(c.env, c.req.raw, {
      gameId: turn.game_id,
      turnId: turn.id,
      kind: 'checkpoint',
      userId: me.id,
    });
    return c.json({ snapshot: snapshotInfo(snap) }, 200);
  },
);

turnRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/turns/{id}/finish',
    tags: ['Saves'],
    summary: 'Upload the final save and end the turn',
    description:
      "The upload becomes the next turn's starting save and the next turn opens. Only the turn's player, while " +
      'active and until the deadline plus grace.',
    ...signedIn,
    request: { params: TurnIdParam, body: zipBody },
    responses: {
      200: jsonResponse(UploadedSchema, 'Stored; turn completed.'),
      ...errorsFor(400, 401, 403, 404, 409, 413),
    },
  }),
  async (c) => {
    const me = c.get('user');
    const turn = await requireOwnActiveTurn(c.env, c.req.valid('param').id, me.id, Date.now());
    const snap = await storeSnapshot(c.env, c.req.raw, {
      gameId: turn.game_id,
      turnId: turn.id,
      kind: 'final',
      userId: me.id,
    });

    const now = Date.now();
    if (!(await markTurnCompleted(c.env, turn.id, snap.id, now)))
      throw new HttpError(409, errors.turnEndedBeforeUpload);
    await setHeadSnapshot(c.env, turn.game_id, snap.id);

    const game = await getGame(c.env, turn.game_id);
    await notify(c.env, game, notifications.turnFinished({ seq: turn.seq, player: await mention(c.env, me.id) }));
    await createNextTurn(c.env, turn.game_id, now);
    return c.json({ snapshot: snapshotInfo(snap) }, 200);
  },
);
