import type { PoolClient } from "pg";
import { db } from "./client.js";

/** Mirrors the on-chain `Phase`, minus `Expired` -- that existed only for a
 * lost program authority, which has no analogue here. */
export type Phase = "open" | "drawn" | "settled";

export interface RoundRow {
  roundId: number;
  phase: Phase;
  commitHash: string;
  revealedSeed: string | null;
  diceA: number | null;
  diceB: number | null;
  startTile: number;
  landedTile: number | null;
  prizeLamports: number;
  nextPrizeLamports: number | null;
  /** Epoch ms, so callers compare against `Date.now()` without converting. */
  locksAtMs: number;
}

export interface GameState {
  currentRound: number;
  avatarPosition: number;
  nextPrizeLamports: number;
  numTiles: number;
  roundDurationSec: number;
}

const ROUND_COLS = `
  round_id, phase, commit_hash, revealed_seed, dice_a, dice_b,
  start_tile, landed_tile, prize_lamports, next_prize_lamports, locks_at`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRound(r: any): RoundRow {
  return {
    roundId: Number(r.round_id),
    phase: r.phase,
    commitHash: r.commit_hash,
    revealedSeed: r.revealed_seed,
    diceA: r.dice_a,
    diceB: r.dice_b,
    startTile: r.start_tile,
    landedTile: r.landed_tile,
    prizeLamports: Number(r.prize_lamports),
    nextPrizeLamports: r.next_prize_lamports == null ? null : Number(r.next_prize_lamports),
    locksAtMs: new Date(r.locks_at).getTime(),
  };
}

/**
 * Read the singleton state row, creating it on first boot.
 *
 * `basePrize` seeds `next_prize_lamports` only when the row does not exist --
 * on every later call the stored value wins, because by then it carries the
 * previous round's tile effect and overwriting it would silently cancel a
 * Random Pump or Get Rugged that players already watched resolve.
 */
export async function getState(basePrize: number): Promise<GameState> {
  const { rows } = await db().query(
    `INSERT INTO game_state (id, next_prize_lamports) VALUES (TRUE, $1)
     ON CONFLICT (id) DO UPDATE SET id = TRUE
     RETURNING current_round, avatar_position, next_prize_lamports, num_tiles, round_duration_sec`,
    [basePrize]
  );
  const r = rows[0];
  return {
    currentRound: Number(r.current_round),
    avatarPosition: r.avatar_position,
    nextPrizeLamports: Number(r.next_prize_lamports),
    numTiles: r.num_tiles,
    roundDurationSec: r.round_duration_sec,
  };
}

export async function getRound(roundId: number): Promise<RoundRow | null> {
  const { rows } = await db().query(
    `SELECT ${ROUND_COLS} FROM rounds WHERE round_id = $1`,
    [roundId]
  );
  return rows.length ? toRound(rows[0]) : null;
}

/**
 * Open the next round and consume the armed prize, in one transaction.
 *
 * Both halves must land together: a round row whose prize was never deducted
 * from `game_state`, or a bumped `current_round` with no round to match it,
 * each leave the loop unable to tell what it should be doing on restart.
 */
export async function openRound(args: {
  roundId: number;
  commitHash: string;
  startTile: number;
  prizeLamports: number;
  /** Epoch ms. Passed in rather than computed as Postgres `now() + interval`
   * so the deadline lives in the server's clock domain -- the same clock the
   * tick loop compares against. Letting the database set it would put any
   * skew between the two hosts straight into the countdown players see. */
  locksAtMs: number;
}): Promise<RoundRow> {
  const { rows } = await db().query(
    `WITH ins AS (
       INSERT INTO rounds (round_id, phase, commit_hash, start_tile, prize_lamports, locks_at)
       VALUES ($1, 'open', $2, $3, $4, $5)
       RETURNING ${ROUND_COLS}
     ), upd AS (
       UPDATE game_state SET current_round = $1 WHERE id = TRUE
     )
     SELECT * FROM ins`,
    [args.roundId, args.commitHash, args.startTile, args.prizeLamports, new Date(args.locksAtMs)]
  );
  return toRound(rows[0]);
}

/** Record the reveal: dice, landing, and the prize the NEXT round will pay. */
export async function recordDraw(args: {
  roundId: number;
  revealedSeed: string;
  diceA: number;
  diceB: number;
  landedTile: number;
  nextPrizeLamports: number;
}): Promise<RoundRow> {
  const { rows } = await db().query(
    `WITH ins AS (
       UPDATE rounds
          SET phase = 'drawn', revealed_seed = $2, dice_a = $3, dice_b = $4,
              landed_tile = $5, next_prize_lamports = $6
        WHERE round_id = $1
       RETURNING ${ROUND_COLS}
     ), upd AS (
       -- Arm the next prize and walk the avatar in the same breath, so a crash
       -- between the two cannot leave the piece and the pot disagreeing.
       UPDATE game_state SET avatar_position = $5, next_prize_lamports = $6 WHERE id = TRUE
     )
     SELECT * FROM ins`,
    [args.roundId, args.revealedSeed, args.diceA, args.diceB, args.landedTile, args.nextPrizeLamports]
  );
  return toRound(rows[0]);
}

export async function markSettled(roundId: number, client?: PoolClient): Promise<void> {
  const q = client ?? db();
  await q.query(
    `UPDATE rounds SET phase = 'settled', settled_at = now() WHERE round_id = $1`,
    [roundId]
  );
}
