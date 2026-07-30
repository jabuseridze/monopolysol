/** Shared DTOs exchanged between the coordinator (server) and the web client. */

export type RoundPhase =
  | "idle" // no active round
  | "open" // accepting picks
  | "locked" // picks closed, awaiting draw
  | "drawing" // hologram spinning
  | "settled"; // winners paid

/** Authoritative snapshot broadcast by the coordinator. */
export interface RoundStateDTO {
  roundId: number;
  phase: RoundPhase;
  /** Whole seconds until the picking window closes (0 once locked). */
  secondsLeft: number;
  /** Epoch ms when the picking window closes. */
  locksAt: number;
  prizeLamports: number;
  numTiles: number;
  /** tileIndex -> number of wallets currently backing it. */
  pickCounts: Record<number, number>;
  /** Published before picks open so the draw is verifiable. */
  commitHash: string | null;
  winningTile: number | null;
  /** Revealed only after the draw so anyone can verify winningTile. */
  revealedSeed: string | null;
  winners: string[];
}

/** Per-second lightweight update to avoid resending the full snapshot. */
export interface TickDTO {
  roundId: number;
  secondsLeft: number;
  phase: RoundPhase;
}

/** Fired ~ALARM_LEAD_SEC before lock to trigger clouds + alarm sound. */
export interface DrawCueDTO {
  roundId: number;
  leadSeconds: number;
}

/** Tells clients which tile the hologram should land on. */
export interface DrawResultDTO {
  roundId: number;
  winningTile: number;
  revealedSeed: string;
  commitHash: string;
}

export interface SettledDTO {
  roundId: number;
  winningTile: number;
  winners: string[];
  prizeLamports: number;
  /** Per-winner share in lamports (0 if no winners -> rolled over). */
  shareLamports: number;
  txSignature: string | null;
}

/** Strongly-typed map of server -> client Socket.IO events. */
export interface ServerToClientEvents {
  "round:state": (s: RoundStateDTO) => void;
  "round:tick": (t: TickDTO) => void;
  "round:drawCue": (c: DrawCueDTO) => void;
  "round:drawResult": (r: DrawResultDTO) => void;
  "round:settled": (s: SettledDTO) => void;
}

export interface ClientToServerEvents {
  /** Client asks for the current snapshot on connect. */
  "client:hello": () => void;
}
