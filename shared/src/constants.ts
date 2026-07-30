/** Shared constants across program client, coordinator, and frontend. */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Default round economics (all overridable via the on-chain GlobalConfig). */
export const DEFAULT_ROUND_DURATION_SEC = 120;
/** Portion of the round spent accepting picks; the rest is the draw sequence. */
export const PICKING_WINDOW_SEC = 105;
/** Draw choreography length (clouds -> spin -> reveal). */
export const DRAW_SEQUENCE_SEC = DEFAULT_ROUND_DURATION_SEC - PICKING_WINDOW_SEC;
/** Seconds before lock when clouds + alarm cue fires. */
export const ALARM_LEAD_SEC = 5;

export const DEFAULT_PRIZE_LAMPORTS = LAMPORTS_PER_SOL / 2; // 0.5 SOL

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
} as const;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
