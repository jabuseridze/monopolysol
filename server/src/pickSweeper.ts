import { PublicKey } from "@solana/web3.js";
import { Chain } from "./chain.js";

/** Same spacing as the payout queue -- one chain call a second, so a busy
 * round's sweep never bursts the RPC endpoint the game itself depends on. */
const SPACING_MS = 1000;
/**
 * How long to wait before re-attempting picks the program refused to close.
 *
 * Winners are the whole reason this exists. The sweep is queued at settle time,
 * but payouts are still draining then (one per second), so `close_pick`
 * correctly refuses every winner it reaches first -- and without a retry those
 * picks would stay open forever, which is exactly the leak this class was
 * written to stop. Comfortably longer than a payout queue takes to drain.
 */
const RETRY_DELAY_MS = 20_000;
/** Give up after this many passes so a pick that can never close -- a winner
 * whose payout keeps failing -- cannot loop forever. */
const MAX_PASSES = 4;

/**
 * Reclaims the rent the coordinator fronted for each pick.
 *
 * Since players paste an address instead of connecting a wallet, the house pays
 * ~0.0013 SOL per guess to open the pick account. Left alone that is a
 * permanent outflow -- picks were never closed, so at a hundred players a round
 * it would run to over a hundred SOL a day and never come back. Closing them
 * turns the cost into a float of a few hundredths of a SOL.
 *
 * Runs entirely outside the round loop, exactly like `PayoutQueue`: a slow or
 * failing sweep must never delay the next round. Anything it misses is picked
 * up on a later pass, because `close_pick` is safe to retry -- an
 * already-closed account simply fails and is dropped.
 */
interface Job {
  roundId: number;
  players: PublicKey[];
  pass: number;
}

export class PickSweeper {
  private queue: Job[] = [];
  private running = false;

  constructor(private chain: Chain) {}

  /** Queue a settled round's picks. Fire-and-forget by design. */
  enqueue(roundId: number, players: PublicKey[]): void {
    if (players.length === 0) return;
    this.queue.push({ roundId, players, pass: 0 });
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return; // one drain at a time; enqueue() only adds work
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        const retry: PublicKey[] = [];

        for (const player of job.players) {
          try {
            await this.chain.closePick(job.roundId, player);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/PickNotClosable/i.test(msg)) {
              // An unpaid winner. Expected on the first pass, because payouts
              // are still draining when the sweep starts -- try again once they
              // have had time to finish.
              retry.push(player);
            } else if (!/AccountNotInitialized|could not find account/i.test(msg)) {
              // Already closed by an earlier pass is fine and silent; anything
              // else is worth seeing.
              console.warn(`[sweeper] round ${job.roundId} ${player.toBase58()}: ${msg}`);
            }
          }
          await sleep(SPACING_MS);
        }

        if (retry.length > 0 && job.pass + 1 < MAX_PASSES) {
          this.requeue({ roundId: job.roundId, players: retry, pass: job.pass + 1 });
        } else if (retry.length > 0) {
          console.warn(
            `[sweeper] round ${job.roundId}: gave up on ${retry.length} pick(s) after ${MAX_PASSES} passes`
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Re-queue after a delay, off the drain loop, so a lone failing job cannot
   * spin the queue at full speed waiting for a payout that hasn't landed. */
  private requeue(job: Job): void {
    setTimeout(() => {
      this.queue.push(job);
      void this.drain();
    }, RETRY_DELAY_MS).unref?.();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
