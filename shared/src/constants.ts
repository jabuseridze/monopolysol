/** Shared constants across program client, coordinator, and frontend. */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Nominal draw-choreography length, in seconds -- a rough reference value
 * only (e.g. for docs/dashboards), NOT consumed by the round loop directly.
 * The picking window is the full on-chain `round_duration`; choreography
 * time is added on top of it after picking closes, never subtracted from
 * it. The coordinator computes the *exact* post-draw sleep per round from
 * `drawSequenceDurationMs()` below, since actual length varies with the
 * dice sum (a 12-step walk takes longer than a 2-step one). */
export const DRAW_SEQUENCE_SEC = 15;
/** Seconds before lock when the alarm cue fires. */
export const ALARM_LEAD_SEC = 5;

export const DEFAULT_PRIZE_LAMPORTS = LAMPORTS_PER_SOL / 2; // 0.5 SOL

/** Per-tile walk-animation step duration (ms), for the avatar hopping tile to
 * tile during the draw sequence. */
export const WALK_STEP_MS = 380;

/**
 * Draw choreography beat-boundary constants, in ms offset from
 * `drawResult.at` (the moment the coordinator reveals the dice). Single
 * source of truth for the beat sheet -- anticipation -> roll -> staggered
 * settle -> sum reveal -> avatar walk -> landing -> celebration ->
 * announcement -- consumed by both the web client (`DrawDirector.tsx` and
 * every choreography component under `web/src/three/`) and the coordinator
 * (`roundLoop.ts`, to size the post-draw sleep so the next round can never
 * open mid-celebration). No magic numbers scattered across components --
 * every beat boundary is named here.
 */
export const BEAT_ANTICIPATION_MS = 1500;
export const BEAT_ROLL_MS = 4500;
export const BEAT_SETTLE_MS = 1500;
export const BEAT_SUM_MS = 1000;
/** Fixed pause after the walk finishes, before the celebration beat begins
 * -- the shockwave/tile-ripple/light-column "impact" window. */
export const BEAT_LANDING_MS = 500;
export const BEAT_CELEBRATION_MS = 3000;

/** Absolute offsets (ms from `drawResult.at`) where each beat begins. */
export const BEAT_ROLL_AT_MS = BEAT_ANTICIPATION_MS;
export const BEAT_SETTLE_AT_MS = BEAT_ROLL_AT_MS + BEAT_ROLL_MS;
export const BEAT_SUM_AT_MS = BEAT_SETTLE_AT_MS + BEAT_SETTLE_MS;
export const BEAT_WALK_AT_MS = BEAT_SUM_AT_MS + BEAT_SUM_MS;

/** Within the "staggered settle" beat: die A locks this far into the beat;
 * die B locks this far in, ~0.7s later than die A -- the held-silence
 * tension gap the user asked for. Both relative to `BEAT_SETTLE_AT_MS`. */
export const DIE_A_LOCK_MS = 350;
export const DIE_B_LOCK_MS = 1150;

/** Small safety margin (ms) the coordinator adds on top of
 * `drawSequenceDurationMs()` before opening the next round, covering
 * client/server clock skew and render jitter beyond the deterministic
 * client-side choreography. */
export const DRAW_SEQUENCE_BUFFER_MS = 600;

/** Total ms the avatar's walk beat occupies for a given dice sum. */
export function walkDurationMs(steps: number): number {
  return steps * WALK_STEP_MS;
}

/**
 * Total ms of the whole draw choreography for a given dice sum -- from
 * `drawResult.at` through the end of the celebration beat. Both the web
 * client (to gate `ResultsModal`'s announcement on choreography completion
 * rather than transaction latency) and the coordinator (to size the
 * post-draw sleep) must agree on this exactly, hence one shared function
 * instead of two hand-synced constants. Varies ~12.8s (sum 2) to ~16.6s
 * (sum 12) with `WALK_STEP_MS` at its current value -- inherent, since a
 * 12-tile walk is genuinely longer than a 2-tile one.
 */
export function drawSequenceDurationMs(steps: number): number {
  return BEAT_WALK_AT_MS + walkDurationMs(steps) + BEAT_LANDING_MS + BEAT_CELEBRATION_MS;
}

/** PDA seed prefixes - must match the on-chain program exactly. */
export const SEED_CONFIG = "config";
export const SEED_TREASURY = "treasury";
export const SEED_ROUND = "round";
export const SEED_PICK = "pick";

/** Socket.IO channel/event names shared by server and web. */
export const SOCKET_EVENTS = {
  /** Full authoritative round snapshot. */
  roundState: "round:state",
  /** Lightweight per-second countdown tick. */
  tick: "round:tick",
  /** Cue the alarm sound just before lock. */
  drawCue: "round:drawCue",
  /** Cue the hologram spin toward the winning tile. */
  drawResult: "round:drawResult",
  /** Final settlement with winners + payout. */
  settled: "round:settled",
  /** Live online-wallet count + current guess tally. */
  presence: "presence",
} as const;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
