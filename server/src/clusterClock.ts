import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { Chain } from "./chain.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cluster (on-chain) unix time in ms, read straight from the Clock sysvar.
 * Layout (little-endian): slot(8) + epoch_start_timestamp(8) + epoch(8) +
 * leader_schedule_epoch(8) + unix_timestamp(8) = 40 bytes.
 */
async function getClusterTimeMs(chain: Chain): Promise<number> {
  const info = await chain.connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (!info) throw new Error("Clock sysvar account not found");
  return Number(info.data.readBigInt64LE(32)) * 1000;
}

/**
 * `reveal_and_draw.rs` gates on `Clock::get()?.unix_timestamp` -- the Solana
 * cluster clock -- not wall-clock time. On a local validator especially,
 * that clock can drift a second or more from the host's `Date.now()`, which
 * previously made the coordinator call `revealAndDraw` before the program
 * agreed the picking window had closed (`PickingStillOpen`, swallowed by
 * `RoundLoop.run()`'s generic 5s retry into repeated wasted transactions on
 * every single round).
 *
 * `now()` is a cheap cached estimate (host time + last-synced offset), fine
 * for frequent, non-critical checks like the per-second picking countdown.
 * `waitUntil()` is the authoritative gate: it polls the chain's *actual*
 * clock (not the cached estimate) before returning, so a caller that awaits
 * it is guaranteed the program will agree the target time has passed --
 * deterministic, instead of firing the tx speculatively and retrying on
 * failure.
 */
export class ClusterClock {
  private offsetMs = 0;

  constructor(private chain: Chain) {}

  /** Refresh the cached wall-clock <-> cluster-clock offset. */
  async sync(): Promise<void> {
    const clusterMs = await getClusterTimeMs(this.chain);
    this.offsetMs = clusterMs - Date.now();
  }

  /** Cheap cluster-adjusted "now", using the last-synced offset. */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Convert a cluster-clock instant into this host's wall-clock domain.
   *
   * The browser can only compare against its own `Date.now()`, so a countdown
   * given a raw cluster deadline drifts by however much the two clocks
   * disagree. On a local validator that is a *rate* difference, not just an
   * offset -- slots are produced faster than 400ms, so its `unix_timestamp`
   * runs well ahead of real time and the gap widens as the round goes on.
   * Re-broadcasting this value on every re-sync keeps the client's deadline
   * converging on the truth instead of lurching toward it.
   */
  toWallMs(clusterMs: number): number {
    return clusterMs - this.offsetMs;
  }

  /** Block until the chain's own clock has reached `targetMs`. Call this
   * right before a tx whose on-chain constraint depends on cluster time. */
  async waitUntil(targetMs: number, pollMs = 1000): Promise<void> {
    // Coast on the cached estimate while clearly early; only start hitting
    // the RPC once we're within one poll interval of the target.
    while (this.now() < targetMs - pollMs) {
      await sleep(pollMs);
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await this.sync();
      if (this.now() >= targetMs) return;
      await sleep(pollMs);
    }
  }
}
