import type { Env } from './platform';

export type { Env };

export interface User {
  id: string;
  display_name: string;
  discord_id: string | null;
}

export type GameStatus = 'setup' | 'running' | 'paused' | 'finished';
export type OrderMode = 'strict' | 'open';

export interface Game {
  id: string;
  name: string;
  owner_id: string;
  status: GameStatus;
  world_name: string;
  player_name: string;
  turn_minutes: number;
  order_mode: OrderMode;
  start_window_hours: number | null;
  discord_webhook_url: string | null;
  invite_code: string | null;
  head_snapshot_id: string | null;
  created_at: number;
}

export interface GamePlayer {
  game_id: string;
  user_id: string;
  position: number;
  role: 'admin' | 'player';
  active: number;
  joined_at: number;
}

export type TurnStatus = 'waiting' | 'active' | 'completed' | 'skipped' | 'expired';

export interface Turn {
  id: string;
  game_id: string;
  seq: number;
  user_id: string | null;
  status: TurnStatus;
  base_snapshot_id: string;
  result_snapshot_id: string | null;
  available_at: number;
  claimed_at: number | null;
  deadline_at: number | null;
  last_heartbeat_at: number | null;
  ended_at: number | null;
}

export type SnapshotKind = 'initial' | 'checkpoint' | 'final';

export interface Snapshot {
  id: string;
  game_id: string;
  turn_id: string | null;
  kind: SnapshotKind;
  sha256: string;
  size: number;
  r2_key: string;
  uploaded_by: string;
  created_at: number;
}

export type AppEnv = { Bindings: Env; Variables: { user: User } };
