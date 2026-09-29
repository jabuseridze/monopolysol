import { PublicKey } from "@solana/web3.js";
import { AckResult } from "@monopoly-sol/shared";
import { GUESS_MAX, GUESS_MIN } from "@monopoly-sol/shared/effects";
import { AppConfig } from "./config.js";
import { insertPick } from "./db/picks.js";
import { Wallet } from "./wallet.js";

/**
 * The one place a player's request becomes a claim on the prize pot.
 *
 * Players paste an address instead of connecting a wallet, so they cannot sign
 * for themselves -- this process records the pick on their behalf. Accepting a
 * guess no longer costs a transaction, so the old balance floor and rent
 * accounting are gone; what remains is the part that still matters, which is
 * bounding how many claims one connection can stake on a shared pot.
 *
 * The duplicate check is enforced twice on purpose. The in-memory set below is
 * a fast reject; the real guarantee is the `picks` primary key, because two
 * concurrent requests for one address can both pass an in-memory check and a
 * second claim on a split prize is a direct loss to the honest winners.
 *
 * Deliberately dependency-free beyond that: a Map and a few counters, reset
 * each round.
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
   * pipeline requests faster than they can be rejected. */
  private inFlight = new Set<string>();

  constructor(
    private cfg: AppConfig,
    private wallet: Wallet,
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
      // Checked against the *pasted address*, never the connection: a holder
      // cannot lend their balance to admit a non-holder.
      if (!(await this.wallet.holdsGateToken(key))) {
        return no("This address doesn't hold the game token.");
      }

      // The authority on duplicates: returns false when the primary key
      // rejects a second pick for this address.
      if (!(await insertPick(w.roundId, key, sum))) {
        return no("This address already has a guess this round.");
      }

      this.addresses.add(key);
      this.picksThisRound++;
      this.perSocket.set(socketId, (this.perSocket.get(socketId) ?? 0) + 1);
      return { ok: true };
    } catch (e: unknown) {
      console.error("[intake] submit failed:", e instanceof Error ? e.message : e);
      return no("Couldn't submit that guess. Try again.");
    } finally {
      this.inFlight.delete(socketId);
    }
  }

  /** Addresses that got a pick in this round. */
  submitted(): string[] {
    return [...this.addresses];
  }

  forget(socketId: string): void {
    this.perSocket.delete(socketId);
    this.inFlight.delete(socketId);
  }
}

const no = (reason: string): AckResult => ({ ok: false, reason });
