/** Shared constants across program client, coordinator, and frontend. */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Default round economics (all overridable via the on-chain GlobalConfig). */
export const DEFAULT_ROUND_DURATION_SEC = 120;
/** Draw choreography length (clouds -> dice roll -> avatar walk -> reveal).
 * The guessing window itself is the full on-chain `round_duration` minus
 * this -- there's no separate "picking window" constant; the server derives
 * it from the on-chain round, not from a shared constant. */
export const DRAW_SEQUENCE_SEC = 15;
/** Seconds before lock when clouds + alarm cue fires. */
export const ALARM_LEAD_SEC = 5;

export const DEFAULT_PRIZE_LAMPORTS = LAMPORTS_PER_SOL / 2; // 0.5 SOL

/** Per-tile walk-animation step duration (ms), for the avatar hopping tile to
 * tile during the draw sequence. */
export const WALK_STEP_MS = 380;
/** Dice tumble/roll animation duration (ms), before the walk begins. */
export const DICE_TUMBLE_MS = 1800;

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
  /** Cue the clouds + alarm sound just before lock. */
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
