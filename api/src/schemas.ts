// Request and response shapes for every endpoint. These drive validation, the OpenAPI spec
// (/api/openapi.json) and the handlers' return types, so the docs can't drift from the code.
// Schemas given a name with .openapi('Name') appear as reusable components in the spec.
import { z } from '@hono/zod-openapi';
import { errors } from './copy/errors';

const Id = z.string().openapi({ example: '3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88' });
// int64 tells client generators these don't fit in a 32-bit int.
const Timestamp = z
  .number()
  .int()
  .openapi({ description: 'Unix epoch milliseconds', format: 'int64', example: 1763164800000 });

// ---- Shared ----

export const ErrorSchema = z
  .object({ error: z.string().openapi({ example: errors.notYourTurnYet }) })
  .openapi('Error', { description: 'Every error response has this shape.' });

export const OkSchema = z.object({ ok: z.literal(true) }).openapi('Ok');

export const UserSchema = z.object({ id: Id, displayName: z.string().openapi({ example: 'Sam' }) }).openapi('User');

export const GameStatusSchema = z.enum(['setup', 'running', 'paused', 'finished']).openapi('GameStatus');
export const OrderModeSchema = z
  .enum(['strict', 'open'])
  .openapi('OrderMode', { description: 'strict: fixed rotation. open: anyone except whoever played last.' });
export const TurnStatusSchema = z.enum(['waiting', 'active', 'completed', 'skipped', 'expired']).openapi('TurnStatus');
export const SnapshotKindSchema = z.enum(['initial', 'checkpoint', 'final']).openapi('SnapshotKind');
export const RoleSchema = z.enum(['admin', 'player']).openapi('Role');

// ---- Path parameters ----

export const GameIdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });
export const TurnIdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });
export const GamePlayerParams = z.object({
  id: Id.openapi({ param: { name: 'id', in: 'path' } }),
  userId: Id.openapi({ param: { name: 'userId', in: 'path' } }),
});
export const GameSnapshotParams = z.object({
  id: Id.openapi({ param: { name: 'id', in: 'path' } }),
  sid: Id.openapi({ param: { name: 'sid', in: 'path' } }),
});
export const InviteCodeParam = z.object({
  code: z.string().openapi({ param: { name: 'code', in: 'path' }, example: 'K7PXM2QRTA' }),
});

// ---- Auth ----

export const DevLoginBody = z.object({ name: z.string().trim().min(1).max(32) }).openapi('DevLoginRequest');
export const TokenSchema = z.object({ token: z.string() }).openapi('Token');

export const DeviceStartSchema = z
  .object({
    deviceCode: z.string().openapi({ description: "The mod's secret for polling. Never shown to the player." }),
    userCode: z.string().openapi({ description: 'What the player types on the site.', example: 'KXQP-7M2R' }),
    verifyUrl: z.string().openapi({ description: 'Site page with the code pre-filled.' }),
    intervalSeconds: z.number().int().openapi({ example: 5 }),
    expiresIn: z.number().int().openapi({ description: 'Seconds until the code expires.', example: 600 }),
  })
  .openapi('DeviceStart');

export const DevicePollBody = z.object({ deviceCode: z.string().min(1) }).openapi('DevicePollRequest');

export const DevicePollSchema = z
  .union([
    z.object({ status: z.literal('pending') }),
    z.object({ status: z.literal('approved'), token: z.string(), user: UserSchema }),
  ])
  .openapi('DevicePoll');

export const DeviceApproveBody = z
  .object({
    userCode: z.string().min(1).openapi({ description: "Case and dashes don't matter.", example: 'KXQP-7M2R' }),
  })
  .openapi('DeviceApproveRequest');

// ---- Games ----

// No defaults here: PATCH must only change the fields it was sent. Creation adds defaults below.
const gameSettingsFields = {
  name: z.string().trim().min(1).max(64).openapi({ example: 'Moon Lord or Bust' }),
  worldName: z.string().trim().min(1).max(64).openapi({ description: 'In-game world name.', example: 'Shared Isle' }),
  playerName: z.string().trim().min(1).max(32).openapi({ description: 'In-game character name.', example: 'Hero' }),
  turnMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  orderMode: OrderModeSchema,
  startWindowHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .nullable()
    .openapi({ description: 'Strict order: auto-skip a turn not started within this many hours. null = never.' }),
  discordWebhookUrl: z
    .string()
    .url()
    .refine((u) => /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(u), errors.discordWebhookInvalid)
    .nullable(),
};

export const CreateGameBody = z
  .object({
    ...gameSettingsFields,
    turnMinutes: gameSettingsFields.turnMinutes.default(60),
    orderMode: gameSettingsFields.orderMode.default('strict'),
    startWindowHours: gameSettingsFields.startWindowHours.default(24),
    discordWebhookUrl: gameSettingsFields.discordWebhookUrl.default(null),
  })
  .openapi('CreateGameRequest');

export const UpdateGameBody = z
  .object(gameSettingsFields)
  .partial()
  .extend({ status: z.enum(['running', 'paused', 'finished']).optional() })
  .openapi('UpdateGameRequest', { description: 'Only the fields sent are changed.' });

export const GameSchema = z
  .object({
    id: Id,
    name: z.string(),
    status: GameStatusSchema,
    worldName: z.string(),
    playerName: z.string(),
    turnMinutes: z.number().int(),
    orderMode: OrderModeSchema,
    startWindowHours: z.number().int().nullable(),
    headSnapshotId: Id.nullable().openapi({ description: 'The save the next turn starts from.' }),
    createdAt: Timestamp,
    inviteCode: z.string().nullable().optional().openapi({ description: 'Admins only.' }),
    discordWebhookUrl: z.string().nullable().optional().openapi({ description: 'Admins only.' }),
  })
  .openapi('Game');

export const GameSummarySchema = GameSchema.extend({ role: RoleSchema }).openapi('GameSummary');

export const PlayerSchema = z
  .object({
    userId: Id,
    displayName: z.string(),
    position: z.number().int().openapi({ description: '0 goes first.' }),
    role: RoleSchema,
    active: z.boolean().openapi({ description: 'false = sitting out; skipped by the rotation.' }),
  })
  .openapi('Player');

export const TurnSchema = z
  .object({
    id: Id,
    seq: z.number().int().openapi({ description: 'Turn number, starting at 1.' }),
    status: TurnStatusSchema,
    userId: Id.nullable().openapi({ description: 'null while an open-order turn is unclaimed.' }),
    userName: z.string().nullable(),
    availableAt: Timestamp,
    claimedAt: Timestamp.nullable(),
    deadlineAt: Timestamp.nullable(),
    endedAt: Timestamp.nullable(),
  })
  .openapi('Turn');

export const SnapshotSchema = z
  .object({
    id: Id,
    sha256: z.string().openapi({ description: 'Hex SHA-256 of the zip.' }),
    size: z.number().int().openapi({ description: 'Bytes.', format: 'int64' }),
    kind: SnapshotKindSchema,
    createdAt: Timestamp,
  })
  .openapi('Snapshot');

export const GameDetailSchema = z
  .object({
    game: GameSchema,
    me: z.object({ userId: Id, role: RoleSchema }),
    players: z.array(PlayerSchema),
    currentTurnId: Id.nullable(),
    turns: z.array(TurnSchema).openapi({ description: 'Latest 100, newest first.' }),
    snapshots: z
      .array(SnapshotSchema.extend({ turnId: Id.nullable() }))
      .openapi({ description: 'Latest 100, newest first.' }),
  })
  .openapi('GameDetail');

export const CreatedGameSchema = z.object({ id: Id }).openapi('CreatedGame');
export const InviteSchema = z.object({ inviteCode: z.string() }).openapi('Invite');
export const JoinedSchema = z.object({ gameId: Id }).openapi('Joined');
export const StartedSchema = z.object({ turnId: Id.nullable() }).openapi('Started');

export const OrderBody = z
  .object({
    userIds: z.array(z.string()).min(1).openapi({ description: 'Every player exactly once, first player first.' }),
  })
  .openapi('OrderRequest');

export const UpdatePlayerBody = z
  .object({ active: z.boolean().optional(), role: RoleSchema.optional() })
  .openapi('UpdatePlayerRequest');

export const SkipBody = z
  .object({
    keepProgress: z.boolean().default(true).openapi({
      description: "For an active turn with a checkpoint: keep that checkpoint as the next turn's starting save.",
    }),
  })
  .openapi('SkipRequest');

export const RollbackBody = z.object({ snapshotId: Id }).openapi('RollbackRequest');

// ---- Turns & saves (used by the mod) ----

export const UploadedSchema = z.object({ snapshot: SnapshotSchema }).openapi('Uploaded');

export const ModGameSchema = z
  .object({
    id: Id,
    name: z.string(),
    status: GameStatusSchema,
    worldName: z.string(),
    playerName: z.string(),
    isAdmin: z.boolean(),
    needsInitialSave: z.boolean(),
    hasInitialSave: z.boolean(),
    canClaim: z.boolean().openapi({ description: 'The caller can start or resume the current turn.' }),
    currentTurn: TurnSchema.nullable(),
  })
  .openapi('ModGame');

export const ModGamesSchema = z
  .object({
    serverNow: Timestamp.openapi({ description: 'Server clock, so the mod can correct for drift.' }),
    user: UserSchema,
    games: z.array(ModGameSchema),
  })
  .openapi('ModGames');

export const ClaimSchema = z
  .object({
    gameId: Id,
    turn: TurnSchema,
    deadlineAt: Timestamp,
    graceMs: z
      .number()
      .int()
      .openapi({ description: 'How long after the deadline uploads are still accepted.', format: 'int64' }),
    serverNow: Timestamp,
    snapshot: SnapshotSchema.openapi({
      description: "Save to download: the turn's latest checkpoint when resuming, otherwise its starting save.",
    }),
    resumed: z.boolean(),
  })
  .openapi('Claim');

export const HeartbeatSchema = z.object({ deadlineAt: Timestamp, serverNow: Timestamp }).openapi('Heartbeat');
