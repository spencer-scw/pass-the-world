import { createRoute } from '@hono/zod-openapi';
import { errors } from './copy/errors';
import {
  addPlayer,
  clearWaitingTurnOwner,
  currentTurn,
  findGameByInviteCode,
  getGame,
  getMembership,
  getSnapshot,
  getUserById,
  insertGameWithOwner,
  lastPlayedTurn,
  latestCheckpoint,
  listGamesForUser,
  listPlayersWithNames,
  listSnapshots,
  listTurnsWithNames,
  markGameStarted,
  requireAdmin,
  resetWaitingTurnWindow,
  rotationPlayers,
  setHeadSnapshot,
  setInviteCode,
  setPlayerActive,
  setPlayerOrder,
  setPlayerRole,
  setWaitingTurnBase,
  updateGame,
} from './db';
import { createRouter, errorsFor, jsonBody, jsonResponse, signedIn, zipBody, zipResponse } from './openapi';
import { canClaimOpenTurn } from './rotation';
import {
  CreatedGameSchema,
  CreateGameBody,
  GameDetailSchema,
  GameIdParam,
  GamePlayerParams,
  GameSchema,
  GameSnapshotParams,
  GameSummarySchema,
  InviteCodeParam,
  InviteSchema,
  JoinedSchema,
  ModGamesSchema,
  OkSchema,
  OrderBody,
  RollbackBody,
  SkipBody,
  StartedSchema,
  UpdateGameBody,
  UpdatePlayerBody,
  UploadedSchema,
} from './schemas';
import { snapshotInfo, storeSnapshot } from './storage';
import { announceInvite } from './notify';
import { closeFinishedGame, createNextTurn, expireTurn, reassignWaitingTurn, skipTurn, turnSummary } from './turns';
import type { Game } from './types';
import { HttpError, newId, randomCode } from './util';

function gameView(g: Game, isAdmin: boolean) {
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    worldName: g.world_name,
    playerName: g.player_name,
    turnMinutes: g.turn_minutes,
    orderMode: g.order_mode,
    startWindowHours: g.start_window_hours,
    headSnapshotId: g.head_snapshot_id,
    createdAt: g.created_at,
    // Admin-only fields
    ...(isAdmin ? { inviteCode: g.invite_code, discordWebhookUrl: g.discord_webhook_url } : {}),
  };
}

export const gameRoutes = createRouter();

// ---- Website ----

gameRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/games',
    tags: ['Games'],
    summary: "List the caller's games",
    description: 'Every game the caller is in, including finished ones, with their role in each.',
    ...signedIn,
    responses: { 200: jsonResponse(GameSummarySchema.array(), 'Newest first.'), ...errorsFor(401) },
  }),
  async (c) => {
    const rows = await listGamesForUser(c.env, c.get('user').id, { includeFinished: true });
    return c.json(
      rows.map((g) => ({ ...gameView(g, g.role === 'admin'), role: g.role })),
      200,
    );
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/games',
    tags: ['Games'],
    summary: 'Create a game',
    description:
      'The game starts in setup. The caller becomes its owner and first admin. If a Discord webhook is set, the ' +
      'invite link is posted to it (also whenever the webhook changes).',
    ...signedIn,
    request: { body: jsonBody(CreateGameBody) },
    responses: { 201: jsonResponse(CreatedGameSchema, 'Created.'), ...errorsFor(400, 401) },
  }),
  async (c) => {
    const settings = c.req.valid('json');
    const id = newId();
    await insertGameWithOwner(
      c.env,
      { id, ownerId: c.get('user').id, inviteCode: randomCode(10), ...settings },
      Date.now(),
    );
    if (settings.discordWebhookUrl) await announceInvite(c.env, await getGame(c.env, id));
    return c.json({ id }, 201);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/games/{id}',
    tags: ['Games'],
    summary: 'Get a game',
    description: 'Everything the game page shows. Non-members get 404.',
    ...signedIn,
    request: { params: GameIdParam },
    responses: { 200: jsonResponse(GameDetailSchema, 'The game.'), ...errorsFor(401, 404) },
  }),
  async (c) => {
    const me = c.get('user');
    const game = await getGame(c.env, c.req.valid('param').id);
    const membership = await getMembership(c.env, game.id, me.id);
    const [players, turns, snapshots, current] = await Promise.all([
      listPlayersWithNames(c.env, game.id),
      listTurnsWithNames(c.env, game.id, 100),
      listSnapshots(c.env, game.id, 100),
      currentTurn(c.env, game.id),
    ]);
    return c.json(
      {
        game: gameView(game, membership.role === 'admin'),
        me: { userId: me.id, role: membership.role },
        players: players.map((p) => ({
          userId: p.user_id,
          displayName: p.display_name,
          position: p.position,
          role: p.role,
          active: p.active === 1,
        })),
        currentTurnId: current?.id ?? null,
        turns: turns.map((t) => turnSummary(t, t.display_name)),
        snapshots: snapshots.map((s) => ({ ...snapshotInfo(s), turnId: s.turn_id })),
      },
      200,
    );
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/games/{id}',
    tags: ['Games'],
    summary: 'Update settings or status',
    description:
      'Only the fields sent are changed. Status can go running ↔ paused, or to finished. Finishing closes the open ' +
      'turn (an active one keeps its last checkpoint) and posts to Discord. Unpausing restarts the ' +
      "waiting player's start window. Changing `orderMode` re-picks who the waiting turn belongs to. World and " +
      'character names can only change during setup.',
    ...signedIn,
    request: { params: GameIdParam, body: jsonBody(UpdateGameBody) },
    responses: { 200: jsonResponse(GameSchema, 'The updated game.'), ...errorsFor(400, 401, 403, 404, 409) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const body = c.req.valid('json');
    const game = await getGame(c.env, gameId);

    const renaming =
      (body.worldName !== undefined && body.worldName !== game.world_name) ||
      (body.playerName !== undefined && body.playerName !== game.player_name);
    if (renaming && game.status !== 'setup') throw new HttpError(409, errors.saveNamesLocked);

    if (body.status) {
      const allowedFrom: Record<string, string[]> = {
        running: ['paused'],
        paused: ['running'],
        finished: ['running', 'paused', 'setup'],
      };
      if (!allowedFrom[body.status].includes(game.status))
        throw new HttpError(409, errors.invalidStatusChange(game.status, body.status));
    }
    await updateGame(c.env, gameId, body);
    if (body.status === 'finished') await closeFinishedGame(c.env, gameId, Date.now());

    if (body.status === 'running') {
      // Unpausing restarts the start window for whoever is up.
      await resetWaitingTurnWindow(c.env, gameId, Date.now());
    }
    if (body.orderMode && body.orderMode !== game.order_mode) {
      // Switching modes: strict turns need an owner, open turns start unclaimed.
      if (body.orderMode === 'open') await clearWaitingTurnOwner(c.env, gameId);
      await reassignWaitingTurn(c.env, await getGame(c.env, gameId));
    }
    const updated = await getGame(c.env, gameId);
    // A new webhook channel hasn't seen the invite yet.
    if (body.discordWebhookUrl && body.discordWebhookUrl !== game.discord_webhook_url)
      await announceInvite(c.env, updated);
    return c.json(gameView(updated, true), 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/games/{id}/invite',
    tags: ['Players'],
    summary: 'Reset the invite link',
    description: "Replaces the invite code. Old invite links stop working. Posts the new link to the game's webhook.",
    ...signedIn,
    request: { params: GameIdParam },
    responses: { 200: jsonResponse(InviteSchema, 'The new invite code.'), ...errorsFor(401, 403, 404) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const code = randomCode(10);
    await setInviteCode(c.env, gameId, code);
    await announceInvite(c.env, await getGame(c.env, gameId), true);
    return c.json({ inviteCode: code }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/join/{code}',
    tags: ['Players'],
    summary: 'Join a game',
    description:
      "Joins from an invite link, at the end of the turn order. Joining a game you're already in does nothing.",
    ...signedIn,
    request: { params: InviteCodeParam },
    responses: { 200: jsonResponse(JoinedSchema, 'Joined.'), ...errorsFor(401, 404, 409) },
  }),
  async (c) => {
    const game = await findGameByInviteCode(c.env, c.req.valid('param').code.toUpperCase());
    if (!game) throw new HttpError(404, errors.inviteInvalid);
    if (game.status === 'finished') throw new HttpError(409, errors.gameFinished);
    await addPlayer(c.env, game.id, c.get('user').id, Date.now());
    return c.json({ gameId: game.id }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/games/{id}/order',
    tags: ['Players'],
    summary: 'Set the turn order',
    description: "In strict order, the waiting turn is reassigned if the change affects who's next.",
    ...signedIn,
    request: { params: GameIdParam, body: jsonBody(OrderBody) },
    responses: { 200: jsonResponse(OkSchema, 'Order saved.'), ...errorsFor(400, 401, 403, 404) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const { userIds } = c.req.valid('json');
    const current = (await rotationPlayers(c.env, gameId)).map((p) => p.userId);
    if (userIds.length !== current.length || !current.every((id) => userIds.includes(id)))
      throw new HttpError(400, errors.orderMustListEveryone);
    await setPlayerOrder(c.env, gameId, userIds);
    await reassignWaitingTurn(c.env, await getGame(c.env, gameId));
    return c.json({ ok: true as const }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/games/{id}/players/{userId}',
    tags: ['Players'],
    summary: 'Update a player',
    description:
      'Lets a player sit out or rejoin, or changes their role. Players sitting out are skipped by the ' +
      'rotation. The owner is always an admin.',
    ...signedIn,
    request: { params: GamePlayerParams, body: jsonBody(UpdatePlayerBody) },
    responses: { 200: jsonResponse(OkSchema, 'Player updated.'), ...errorsFor(400, 401, 403, 404) },
  }),
  async (c) => {
    const { id: gameId, userId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const game = await getGame(c.env, gameId);
    const target = await getMembership(c.env, gameId, userId);
    const body = c.req.valid('json');
    if (body.role === 'player' && target.user_id === game.owner_id) throw new HttpError(400, errors.ownerAlwaysAdmin);
    if (body.active !== undefined) await setPlayerActive(c.env, gameId, target.user_id, body.active);
    if (body.role) await setPlayerRole(c.env, gameId, target.user_id, body.role);
    await reassignWaitingTurn(c.env, game);
    return c.json({ ok: true as const }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/games/{id}/snapshots/initial',
    tags: ['Saves'],
    summary: 'Upload the starting save',
    description: 'Called by the mod. Uploads or replaces the starting save; only allowed during setup.',
    ...signedIn,
    request: { params: GameIdParam, body: zipBody },
    responses: { 200: jsonResponse(UploadedSchema, 'Stored.'), ...errorsFor(400, 401, 403, 404, 409, 413) },
  }),
  async (c) => {
    const me = c.get('user');
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, me.id);
    const game = await getGame(c.env, gameId);
    if (game.status !== 'setup') throw new HttpError(409, errors.startingSaveLocked);
    const snap = await storeSnapshot(c.env, c.req.raw, { gameId, turnId: null, kind: 'initial', userId: me.id });
    await setHeadSnapshot(c.env, gameId, snap.id);
    return c.json({ snapshot: snapshotInfo(snap) }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/games/{id}/start',
    tags: ['Games'],
    summary: 'Start the game',
    description: 'Moves the game from setup to running and opens turn 1. Requires a starting save.',
    ...signedIn,
    request: { params: GameIdParam },
    responses: { 200: jsonResponse(StartedSchema, 'Started.'), ...errorsFor(401, 403, 404, 409) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const game = await getGame(c.env, gameId);
    if (game.status !== 'setup') throw new HttpError(409, errors.gameAlreadyStarted);
    if (!game.head_snapshot_id) throw new HttpError(409, errors.startingSaveMissing);
    if (!(await markGameStarted(c.env, gameId))) throw new HttpError(409, errors.gameAlreadyStarted);
    const turn = await createNextTurn(c.env, gameId, Date.now());
    return c.json({ turnId: turn?.id ?? null }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/games/{id}/turns/current/skip',
    tags: ['Turns'],
    summary: 'Skip the current turn',
    description:
      'Ends the current turn early. An active turn with a checkpoint and `keepProgress` expires, and its last ' +
      "checkpoint becomes the next turn's starting save. Otherwise the turn is skipped and its progress discarded. " +
      'Either way the next turn opens.',
    ...signedIn,
    request: { params: GameIdParam, body: jsonBody(SkipBody, false) },
    responses: { 200: jsonResponse(OkSchema, 'Turn ended.'), ...errorsFor(400, 401, 403, 404, 409) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const { keepProgress = true } = c.req.valid('json');
    const turn = await currentTurn(c.env, gameId);
    if (!turn) throw new HttpError(409, errors.noTurnInProgress);
    const now = Date.now();
    const done =
      turn.status === 'active' && keepProgress && (await latestCheckpoint(c.env, turn.id))
        ? await expireTurn(c.env, turn, now, 'admin')
        : await skipTurn(c.env, turn, now, { kind: 'admin' });
    if (!done) throw new HttpError(409, errors.turnChangedState);
    return c.json({ ok: true as const }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/games/{id}/rollback',
    tags: ['Saves'],
    summary: 'Roll back to an earlier save',
    description:
      'Makes an earlier save the starting point for the next turn. Not allowed while a turn is being played.',
    ...signedIn,
    request: { params: GameIdParam, body: jsonBody(RollbackBody) },
    responses: { 200: jsonResponse(OkSchema, 'Rolled back.'), ...errorsFor(400, 401, 403, 404, 409) },
  }),
  async (c) => {
    const { id: gameId } = c.req.valid('param');
    await requireAdmin(c.env, gameId, c.get('user').id);
    const snap = await getSnapshot(c.env, gameId, c.req.valid('json').snapshotId);
    const turn = await currentTurn(c.env, gameId);
    if (turn?.status === 'active') throw new HttpError(409, errors.rollbackDuringActiveTurn);
    await setHeadSnapshot(c.env, gameId, snap.id);
    if (turn) await setWaitingTurnBase(c.env, turn.id, snap.id);
    return c.json({ ok: true as const }, 200);
  },
);

gameRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/games/{id}/snapshots/{sid}/download',
    tags: ['Saves'],
    summary: 'Download a save',
    ...signedIn,
    request: { params: GameSnapshotParams },
    responses: { 200: zipResponse, ...errorsFor(401, 404) },
  }),
  async (c) => {
    const { id: gameId, sid } = c.req.valid('param');
    await getMembership(c.env, gameId, c.get('user').id);
    const snap = await getSnapshot(c.env, gameId, sid);
    const body = await c.env.blobs.get(snap.r2_key);
    if (!body) throw new HttpError(404, errors.saveFileMissing);
    return c.body(body, 200, {
      'Content-Type': 'application/zip',
      'Content-Length': String(snap.size),
      'Content-Disposition': `attachment; filename="ptw-${snap.kind}-${snap.id.slice(0, 8)}.zip"`,
      'X-Content-SHA256': snap.sha256,
    });
  },
);

// ---- Mod ----

gameRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/mod/games',
    tags: ['Turns'],
    summary: 'Status for the in-game menu',
    description:
      "The caller's unfinished games, each with its current turn and whether the caller can start or resume it.",
    ...signedIn,
    responses: { 200: jsonResponse(ModGamesSchema, "The caller's games."), ...errorsFor(401) },
  }),
  async (c) => {
    const me = c.get('user');
    const games = await listGamesForUser(c.env, me.id, { includeFinished: false });
    const result = await Promise.all(
      games.map(async (g) => {
        const turn = await currentTurn(c.env, g.id);
        const turnUser = turn?.user_id ? ((await getUserById(c.env, turn.user_id))?.display_name ?? null) : null;
        let canClaim = false;
        if (turn && g.status === 'running' && g.active === 1) {
          if (turn.status === 'active') canClaim = turn.user_id === me.id; // resume
          else if (g.order_mode === 'strict') canClaim = turn.user_id === me.id;
          else
            canClaim = canClaimOpenTurn(
              await rotationPlayers(c.env, g.id),
              (await lastPlayedTurn(c.env, g.id))?.user_id ?? null,
              me.id,
            );
        }
        return {
          id: g.id,
          name: g.name,
          status: g.status,
          worldName: g.world_name,
          playerName: g.player_name,
          isAdmin: g.role === 'admin',
          needsInitialSave: g.status === 'setup' && g.role === 'admin',
          hasInitialSave: g.head_snapshot_id != null,
          canClaim,
          currentTurn: turn ? turnSummary(turn, turnUser) : null,
        };
      }),
    );
    return c.json({ serverNow: Date.now(), user: { id: me.id, displayName: me.display_name }, games: result }, 200);
  },
);
