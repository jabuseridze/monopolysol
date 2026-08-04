/** Shared DTOs exchanged between the coordinator (server) and the web client. */

export type RoundPhase =
  | "idle" // no active round
  | "open" // accepting guesses
  | "locked" // guesses closed, awaiting draw
  | "drawing" // dice roll / avatar walk sequence
  | "settled"; // winners paid

/** Authoritative snapshot broadcast by the coordinator. */
export interface RoundStateDTO {
  roundId: number;
  phase: RoundPhase;
  /** Whole seconds until the guessing window closes (0 once locked). */
  secondsLeft: number;
  /** Epoch ms when the guessing window closes. */
  locksAt: number;
  /**
   * Whole seconds the guessing window lasts, from the chain's own
   * `locksAt - openedAt`. The client's ring clock needs a denominator, and
   * deriving one from the largest `secondsLeft` it happens to have seen would
   * start the ring wrong for anyone who joins mid-round.
   */
  durationSec: number;
  prizeLamports: number;
  numTiles: number;
  /** guessSum (2-12) -> number of wallets currently backing it. */
  guessCounts: Record<number, number>;
  /** Published before guesses open so the draw is verifiable. */
  commitHash: string | null;
  /** Tile the avatar is currently resting on (or landed on, once drawn). */
  avatarTile: number;
  /** Tile the avatar landed on this round's draw, once known. */
  landedTile: number | null;
  /** Revealed only after the draw so anyone can verify landedTile. */
  revealedSeed: string | null;
  winners: string[];
  /** Prize armed for the round after this one (may be boosted by an effect tile). */
  nextPrizeLamports: number;
  /**
   * Always 0 on this channel -- presence is broadcast separately and on its own
   * cadence (see `PresenceDTO` / the `presence` event), so the round snapshot
   * never carries a live count. Read `useGame().onlineWallets` for the real
   * value; binding a UI counter to this field would pin it at zero forever.
   */
  onlineWallets: number;
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

/** Tells clients how to animate the dice roll + avatar walk. */
export interface DrawResultDTO {
  roundId: number;
  diceA: number;
  diceB: number;
  startTile: number;
  landedTile: number;
  revealedSeed: string;
  commitHash: string;
}

export interface SettledDTO {
  roundId: number;
  landedTile: number;
  winners: string[];
  prizeLamports: number;
  /** Per-winner share in lamports (0 if no winners -> rolled over). */
  shareLamports: number;
  txSignature: string | null;
}

/** Live presence broadcast: distinct online wallets + current guess tally. */
export interface PresenceDTO {
  onlineWallets: number;
  guessCounts: Record<number, number>;
}

/** Strongly-typed map of server -> client Socket.IO events. */
export interface ServerToClientEvents {
  "round:state": (s: RoundStateDTO) => void;
  "round:tick": (t: TickDTO) => void;
  "round:drawCue": (c: DrawCueDTO) => void;
  "round:drawResult": (r: DrawResultDTO) => void;
  "round:settled": (s: SettledDTO) => void;
  "presence": (p: PresenceDTO) => void;
}

export interface ClientToServerEvents {
  /** Client announces (or clears) its connected wallet on connect/change. */
  "client:hello": (walletBase58: string | null) => void;
}
