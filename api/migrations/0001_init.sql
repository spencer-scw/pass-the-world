-- All timestamps are unix epoch milliseconds.

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  discord_id   TEXT UNIQUE,
  created_at   INTEGER NOT NULL
);

-- Bearer tokens for the website ('web') and the tModLoader mod ('mod'). Only the hash is stored.
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('web', 'mod')),
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

-- Device-code flow used to link the mod to an account.
CREATE TABLE device_codes (
  device_code_hash TEXT PRIMARY KEY,
  user_code        TEXT NOT NULL UNIQUE,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,  -- set when approved on the site
  issued           INTEGER NOT NULL DEFAULT 0,                     -- 1 once the mod has collected its token
  expires_at       INTEGER NOT NULL
);

CREATE TABLE games (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  owner_id            TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'running', 'paused', 'finished')),
  world_name          TEXT NOT NULL,   -- in-game names, used by the mod to find the starting save
  player_name         TEXT NOT NULL,
  turn_minutes        INTEGER NOT NULL DEFAULT 60,
  order_mode          TEXT NOT NULL DEFAULT 'strict' CHECK (order_mode IN ('strict', 'open')),
  start_window_hours  INTEGER,         -- strict mode: auto-skip if not started within N hours. NULL = never.
  discord_webhook_url TEXT,
  invite_code         TEXT UNIQUE,
  head_snapshot_id    TEXT,            -- the save the next turn starts from
  created_at          INTEGER NOT NULL
);

CREATE TABLE game_players (
  game_id   TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id),
  position  INTEGER NOT NULL,
  role      TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  active    INTEGER NOT NULL DEFAULT 1,  -- inactive players are skipped by the rotation
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, user_id)
);

-- At most one turn per game is 'waiting' or 'active' at a time.
CREATE TABLE turns (
  id                 TEXT PRIMARY KEY,
  game_id            TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq                INTEGER NOT NULL,
  user_id            TEXT REFERENCES users(id),  -- NULL while an open-order turn is unclaimed
  status             TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'completed', 'skipped', 'expired')),
  base_snapshot_id   TEXT NOT NULL,
  result_snapshot_id TEXT,
  available_at       INTEGER NOT NULL,
  claimed_at         INTEGER,
  deadline_at        INTEGER,
  last_heartbeat_at  INTEGER,
  ended_at           INTEGER,
  UNIQUE (game_id, seq)
);
CREATE INDEX turns_open ON turns (status, game_id) WHERE status IN ('waiting', 'active');

CREATE TABLE snapshots (
  id          TEXT PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_id     TEXT REFERENCES turns(id),
  kind        TEXT NOT NULL CHECK (kind IN ('initial', 'checkpoint', 'final')),
  sha256      TEXT NOT NULL,
  size        INTEGER NOT NULL,
  r2_key      TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX snapshots_by_turn ON snapshots (turn_id, created_at);
