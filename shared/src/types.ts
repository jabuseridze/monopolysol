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
  /** Epoch ms when the guessing window closes, on the *cluster* clock. */
  locksAt: number;
  /**
   * The same deadline translated into wall-clock epoch ms, which is the only
   * domain a browser can compare against. **This is what the countdown must
   * read** -- the cluster clock can run at a different *rate* from real time
   * (markedly so on a local validator), so a client counting down against
   * `locksAt` skips a block of seconds and then freezes short of zero.
   * Re-sent on every server clock re-sync, so the estimate converges.
   */
  locksAtWall: number;
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
  /**
   * The wallet prizes are paid from, for the "verify payouts" link.
   *
   * Broadcast rather than configured in the client: it used to be derived
   * locally from the program id, and the two could not disagree. Now that
   * prizes come from an ordinary wallet only the server knows, a
   * `NEXT_PUBLIC_*` copy would be baked in at build time and silently point at
   * the old wallet for as long as nobody redeployed the frontend -- showing
   * players a page with none of their payouts on it.
   *
   * Null until the first snapshot arrives.
   */
  payoutWallet: string | null;
}

/** Per-second lightweight update to avoid resending the full snapshot. */
export interface TickDTO {
  roundId: number;
  /** Server's own view of the remaining seconds. The client displays its own
   * figure derived from `locksAtWall`; this is kept for logging and as a
   * fallback before the first tick carrying a deadline arrives. */
  secondsLeft: number;
  /** Refreshed wall-clock deadline -- see `RoundStateDTO.locksAtWall`. */
  locksAtWall: number;
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
}

/**
 * Payout progress for a round, broadcast as the background queue drains.
 *
 * Payouts deliberately outlive the round that produced them: `settled` fires
 * as soon as the winners are known, and the coordinator pays them off the
 * round loop so a slow confirmation can never stall the game. That means a
 * client learns *who won* before it learns *who has been paid*, and these
 * arrive afterwards -- possibly while a later round is already running.
 */
export interface PayoutProgressDTO {
  roundId: number;
  /** winner base58 -> transaction signature. Grows as the queue drains. */
  paid: Record<string, string>;
  /** Winners the queue gave up on. They can claim manually instead. */
  failed: string[];
  /** True once the queue has no more work for this round. */
  done: boolean;
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
  "round:payouts": (p: PayoutProgressDTO) => void;
  "presence": (p: PresenceDTO) => void;
}

/** Result of a request the client asked the coordinator to perform on its
 * behalf. `reason` is written to be shown to a player verbatim. */
export type AckResult = { ok: true } | { ok: false; reason: string };

export interface ClientToServerEvents {
  /** Client announces (or clears) its wallet address on connect/change. */
  "client:hello": (walletBase58: string | null) => void;

  /**
   * Ask the coordinator to submit a guess for a pasted address.
   *
   * Players do not sign: the address is typed, not connected, so the
   * coordinator builds and pays for the transaction. The chain still verifies
   * the address holds the game token (`token_gate.rs` reads the token
   * account's own owner field), so this cannot be used to play as a
   * non-holder -- but it is why the coordinator rate-limits this path.
   */
  "client:guess": (
    p: { address: string; sum: number },
    ack: (r: AckResult) => void
  ) => void;

  /**
   * Ask the coordinator to retry payouts for a round.
   *
   * The safety net for walletless play: a player cannot sign a `payout`
   * themselves, so if the coordinator's queue gave up, this is how the prize
   * gets moved. Safe for anyone to call -- `payout` is permissionless and its
   * destination is pinned on-chain to the winner.
   */
  "client:retryPayout": (
    p: { roundId: number },
    ack: (r: AckResult) => void
  ) => void;
}
