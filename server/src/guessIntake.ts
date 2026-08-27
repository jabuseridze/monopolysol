import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AckResult } from "@monopoly-sol/shared";
import { GUESS_MAX, GUESS_MIN } from "@monopoly-sol/shared/effects";
import { AppConfig } from "./config.js";
import { Chain } from "./chain.js";
import { associatedTokenAddress } from "./ata.js";

/**
 * The one place a player's request turns into a transaction the house pays for.
 *
 * Players paste an address instead of connecting a wallet, so they cannot sign
 * and cannot fund their own pick -- the coordinator does both. That makes this
 * the only spend-side attack surface in the server, and the reason every check
 * below exists. The chain re-verifies everything that matters (the token gate
 * reads the token account's own owner field, and the pick PDA's `init` enforces
 * one guess per address per round); these checks exist to reject the obvious
 * cases *before* burning a transaction fee on a guaranteed failure, and to stop
 * an unbounded drain of the authority wallet.
 *
 * Deliberately dependency-free: a Map and a few counters, reset each round.
 */
export interface RoundWindow {
  roundId: number;
  locksAt: number;
  open: boolean;
}

export class GuessIntake {
  private roundId = -1;
  private picksThisRound = 0;
  private perSocket = new Map<string, number>();
  private addresses = new Set<string>();
  /** Sockets with a submit in flight -- one at a time, so a client cannot
   * pipeline requests faster than the chain can reject them. */
  private inFlight = new Set<string>();

  constructor(
    private cfg: AppConfig,
    private chain: Chain,
    private window: () => RoundWindow | null
  ) {}

  /** Wipe per-round counters. Called by the loop when a round opens. */
  reset(roundId: number): void {
    this.roundId = roundId;
    this.picksThisRound = 0;
    this.perSocket.clear();
    this.addresses.clear();
  }

  async submit(socketId: string, address: string, sum: number): Promise<AckResult> {
    const w = this.window();
    if (!w || !w.open) return no("The round isn't open for guesses right now.");
    if (Date.now() >= w.locksAt) return no("Guessing just closed for this round.");
    if (w.roundId !== this.roundId) this.reset(w.roundId);

    if (!Number.isInteger(sum) || sum < GUESS_MIN || sum > GUESS_MAX) {
      return no(`Pick a dice sum between ${GUESS_MIN} and ${GUESS_MAX}.`);
    }

    let player: PublicKey;
    try {
      player = new PublicKey(address.trim());
    } catch {
      return no("That doesn't look like a Solana address.");
    }
    const key = player.toBase58();

    // Cheap in-memory duplicate check. The chain enforces this too (the pick
    // PDA's `init` fails on a second guess), but catching it here saves a fee.
    if (this.addresses.has(key)) return no("This address already guessed this round.");

    if (this.inFlight.has(socketId)) return no("Still submitting your last guess.");
    if ((this.perSocket.get(socketId) ?? 0) >= this.cfg.maxGuessesPerSocket) {
      return no("Too many guesses from this connection this round.");
    }
    if (this.picksThisRound >= this.cfg.maxPicksPerRound) {
      return no("This round is full. Try the next one.");
    }

    this.inFlight.add(socketId);
    try {
      // Balance floor. The house funds every pick (~0.0013 SOL of rent plus
      // fees), so without this a burst of guesses could empty the wallet that
      // also has to open rounds, reveal, settle and pay winners -- taking the
      // whole game down rather than just refusing a guess.
      const lamports = await this.chain.connection.getBalance(this.cfg.authority.publicKey);
      if (lamports < this.cfg.minAuthoritySol * LAMPORTS_PER_SOL) {
        console.error("[intake] authority balance below floor; refusing guesses");
        return no("The game is temporarily not accepting guesses.");
      }

      const ata = this.cfg.gateMint ? associatedTokenAddress(player, this.cfg.gateMint) : null;
      await this.chain.submitGuess(w.roundId, player, sum, ata);

      this.addresses.add(key);
      this.picksThisRound++;
      this.perSocket.set(socketId, (this.perSocket.get(socketId) ?? 0) + 1);
      return { ok: true };
    } catch (e: unknown) {
      return no(explain(e));
    } finally {
      this.inFlight.delete(socketId);
    }
  }

  /** Addresses that got a pick in this round -- the sweeper's work list. */
  submitted(): string[] {
    return [...this.addresses];
  }

  forget(socketId: string): void {
    this.perSocket.delete(socketId);
    this.inFlight.delete(socketId);
  }
}

const no = (reason: string): AckResult => ({ ok: false, reason });

/**
 * Turn a chain error into something worth showing a player.
 *
 * Only two cases are worth naming. "already in use" is the pick PDA rejecting a
 * second guess -- which is also exactly what a griefed player sees, so the
 * wording avoids accusing them of having guessed. `TokenGateFailed` is the
 * holder check, the one thing a player can actually act on.
 */
function explain(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/already in use/i.test(msg)) return "This address already has a guess this round.";
  if (/TokenGateFailed/i.test(msg)) return "This address doesn't hold the game token.";
  console.error("[intake] submit failed:", msg);
  return "Couldn't submit that guess. Try again.";
}
