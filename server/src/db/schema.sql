-- MONOPOLYSOL round storage.
--
-- This replaces what the Anchor program's accounts used to hold. Two of the
-- constraints below are not tidiness -- they are the rules the chain used to
-- enforce for us, and the game is unsafe without them:
--
--   * picks' PRIMARY KEY (round_id, player) is what made a second guess from
--     one address impossible. On-chain that came free, because the pick PDA
--     was seeded on round+player and a repeat init simply failed.
--   * picks.paid is what stops a winner being paid twice. It replaces the
--     `claimed` flag on PlayerPick, and like that flag it must be set in the
--     same transaction as the transfer it records.
--
-- Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS rounds (
  round_id            BIGINT PRIMARY KEY,
  -- 'open' | 'drawn' | 'settled'. Mirrors the on-chain Phase enum, minus
  -- 'expired', which existed only for a lost program authority.
  phase               TEXT        NOT NULL,

  -- Commit-reveal. The hash is published when the round opens; the seed stays
  -- NULL until the picking window closes, so the row itself proves the order.
  commit_hash         TEXT        NOT NULL,
  revealed_seed       TEXT,

  dice_a              SMALLINT,
  dice_b              SMALLINT,
  -- Where the avatar stood before this round's walk; lets a page refresh
  -- rebuild the walk rather than teleporting the piece.
  start_tile          INTEGER     NOT NULL,
  landed_tile         INTEGER,

  -- Snapshotted at open time from game_state.next_prize_lamports, so a tile
  -- effect that lands later cannot retroactively change what this round pays.
  prize_lamports      BIGINT      NOT NULL,
  next_prize_lamports BIGINT,

  opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  locks_at            TIMESTAMPTZ NOT NULL,
  settled_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS picks (
  round_id  BIGINT      NOT NULL REFERENCES rounds(round_id) ON DELETE CASCADE,
  player    TEXT        NOT NULL,
  guess     SMALLINT    NOT NULL CHECK (guess BETWEEN 2 AND 12),
  paid      BOOLEAN     NOT NULL DEFAULT FALSE,
  paid_sig  TEXT,
  lamports  BIGINT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, player)
);

-- The picking window's count query and the winner lookup both filter on
-- round_id alone; the primary key leads with it, but an explicit index keeps
-- the guess-count aggregate off a sequential scan as history grows.
CREATE INDEX IF NOT EXISTS picks_round_guess_idx ON picks (round_id, guess);

-- Single row. Replaces GlobalConfig: the avatar's position and the armed prize
-- have to outlive any one round, and a restart has to find them.
CREATE TABLE IF NOT EXISTS game_state (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  current_round       BIGINT  NOT NULL DEFAULT 0,
  avatar_position     INTEGER NOT NULL DEFAULT 0,
  -- Armed by the previous round's landing tile (see shared/src/effects.ts).
  next_prize_lamports BIGINT  NOT NULL,
  num_tiles           INTEGER NOT NULL DEFAULT 40,
  round_duration_sec  INTEGER NOT NULL DEFAULT 100
);
