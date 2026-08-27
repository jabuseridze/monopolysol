import { PublicKey } from "@solana/web3.js";
import { PayoutProgressDTO } from "@monopoly-sol/shared";
import { Chain } from "./chain.js";

/**
 * Pays winners *off* the round loop.
 *
 * Payouts used to run inline in `drawAndSettle`, one transaction per winner,
 * each awaiting its own confirmation before the next began. Because that ran
 * inside the loop, the next round could not open until the last winner was
 * paid -- roughly a second per winner, so thirty winners froze the game for
 * half a minute. Worse, the `settled` broadcast came *after* the loop, so
 * players didn't even learn who won until every transaction had landed.
 *
 * This queue keeps the same one-transaction-per-winner shape (deliberately --
 * see `SPACING_MS`) but moves it into the background, so the only thing that
 * waits on a payout is the payout itself.
 */

/** Gap between sends. Payouts are not urgent -- the result is already on
 * screen -- and pacing them keeps a big winner list from becoming a burst of
 * traffic against the same RPC endpoint every player is also using. */
const SPACING_MS = 1000;
/** Attempts per winner before giving up and leaving it to a manual claim.
 * Retrying is safe: `payout` is idempotent on-chain via `pick.claimed`, so a
 * retry after an ambiguous timeout can never double-pay. */
const MAX_ATTEMPTS = 3;
/** Backoff between attempts for one winner. */
const RETRY_BASE_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Job {
  roundId: number;
  winners: PublicKey[];
}

export class PayoutQueue {
  private jobs: Job[] = [];
  private running = false;

  constructor(
    private readonly chain: Chain,
    private readonly emit: (p: PayoutProgressDTO) => void
  ) {}

  /** Hand a round's winners over and return immediately. */
  enqueue(roundId: number, winners: PublicKey[]): void {
    if (winners.length === 0) return;
    this.jobs.push({ roundId, winners });
    // Deliberately not awaited: the caller is the round loop, and the whole
    // point is that it does not wait for this.
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return; // one drain at a time; enqueue() just adds work
    this.running = true;
    try {
      let job: Job | undefined;
      while ((job = this.jobs.shift())) {
        await this.payRound(job);
      }
    } finally {
      this.running = false;
    }
  }

  private async payRound({ roundId, winners }: Job): Promise<void> {
    const paid: Record<string, string> = {};
    const failed: string[] = [];

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]!;
      const key = winner.toBase58();
      const sig = await this.payOne(roundId, winner);

      if (sig) paid[key] = sig;
      else failed.push(key);

      // Report after every winner rather than at the end, so a player sees
      // their own payout land without waiting on everyone else's.
      this.emit({ roundId, paid, failed, done: i === winners.length - 1 });

      if (i < winners.length - 1) await sleep(SPACING_MS);
    }

    if (failed.length > 0) {
      console.warn(
        `[payouts] round ${roundId}: ${failed.length} unpaid after ${MAX_ATTEMPTS} attempts ` +
          `(claimable by the winner): ${failed.join(", ")}`
      );
    } else {
      console.log(`[payouts] round ${roundId}: paid ${winners.length} winner(s)`);
    }
  }

  /** Returns the signature, or null once the retries are exhausted. */
  private async payOne(roundId: number, winner: PublicKey): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.chain.payout(roundId, winner);
      } catch (e) {
        const last = attempt === MAX_ATTEMPTS;
        console.error(
          `[payouts] round ${roundId} winner ${winner.toBase58()} attempt ${attempt}/${MAX_ATTEMPTS} failed`,
          last ? e : (e as Error)?.message ?? e
        );
        if (!last) await sleep(RETRY_BASE_MS * attempt);
      }
    }
    return null;
  }
}
