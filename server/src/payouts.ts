import { PayoutProgressDTO } from "@monopoly-sol/shared";
import { payOnce } from "./db/picks.js";
import { Wallet } from "./wallet.js";

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
/** Attempts per winner before giving up. Retrying is safe: `payOnce` claims
 * the pick row `FOR UPDATE` and re-checks `paid` inside the transaction, so a
 * retry after an ambiguous timeout cannot double-pay. */
const MAX_ATTEMPTS = 3;
/** Backoff between attempts for one winner. */
const RETRY_BASE_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Job {
  roundId: number;
  winners: string[];
  /** Each winner's equal share, fixed by the caller at settle time. */
  share: number;
}

export class PayoutQueue {
  private jobs: Job[] = [];
  private running = false;

  constructor(
    private readonly wallet: Wallet,
    private readonly emit: (p: PayoutProgressDTO) => void
  ) {}

  /** Hand a round's winners over and return immediately. */
  enqueue(roundId: number, winners: string[], share: number): void {
    if (winners.length === 0 || share <= 0) return;
    this.jobs.push({ roundId, winners, share });
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

  private async payRound({ roundId, winners, share }: Job): Promise<void> {
    const paid: Record<string, string> = {};
    const failed: string[] = [];

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]!;
      const sig = await this.payOne(roundId, winner, share);

      if (sig) paid[winner] = sig;
      else failed.push(winner);

      // Report after every winner rather than at the end, so a player sees
      // their own payout land without waiting on everyone else's.
      this.emit({ roundId, paid, failed, done: i === winners.length - 1 });

      if (i < winners.length - 1) await sleep(SPACING_MS);
    }

    if (failed.length > 0) {
      console.warn(
        `[payouts] round ${roundId}: ${failed.length} unpaid after ${MAX_ATTEMPTS} attempts ` +
          `(retryable from the results modal): ${failed.join(", ")}`
      );
    } else {
      console.log(`[payouts] round ${roundId}: paid ${winners.length} winner(s)`);
    }
  }

  /** Returns the signature, or null once the retries are exhausted. A pick
   * that was already paid also returns null -- and is reported as failed,
   * which is correct for a retry: nothing was owed, so nothing was sent. */
  private async payOne(roundId: number, winner: string, share: number): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await payOnce(roundId, winner, share, () =>
          this.wallet.payWinner(winner, share)
        );
      } catch (e) {
        const last = attempt === MAX_ATTEMPTS;
        console.error(
          `[payouts] round ${roundId} winner ${winner} attempt ${attempt}/${MAX_ATTEMPTS} failed`,
          last ? e : (e as Error)?.message ?? e
        );
        if (!last) await sleep(RETRY_BASE_MS * attempt);
      }
    }
    return null;
  }
}
