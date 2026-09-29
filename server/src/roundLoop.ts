import { DRAW_SEQUENCE_BUFFER_MS, drawSequenceDurationMs, RoundStateDTO } from "@monopoly-sol/shared";
import { unpaidWinners, winnersFor } from "./db/picks.js";
import { getRound, getState } from "./db/rounds.js";
import { Emitter } from "./emitter.js";
import { PayoutQueue } from "./payouts.js";
import { drawAndSettle, LoopCtx, pickingPhase } from "./roundPhases.js";
import { openNewRound, resumeOpenRound } from "./roundOpen.js";
import { Wallet } from "./wallet.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Orchestration shell only -- per-phase logic lives in `roundOpen.ts` (open
 * / resume-open) and `roundPhases.ts` (picking tick loop, reveal-through-
 * payout). On every iteration (including after a recovered crash), `cycle()`
 * reads the *stored* current round instead of blindly opening a new one:
 *
 *   - phase open,    now <  locksAt -> resume the picking-window tick loop
 *   - phase open,    now >= locksAt -> skip straight to reveal
 *   - phase drawn                   -> skip picking + reveal, go to settle
 *   - phase settled (or no round)   -> open a new round
 *
 * This is what lets a `kill -9` mid-round resume the same round on restart
 * instead of orphaning it and opening a duplicate. That recovery used to come
 * free from reading the chain back; it now depends entirely on the round
 * having been written to Postgres, which is why the database is a hard
 * dependency rather than a cache.
 */
export class RoundLoop {
  private snapshot: RoundStateDTO = emptySnapshot();
  private readonly ctx: LoopCtx;

  constructor(
    wallet: Wallet,
    emit: Emitter,
    masterSecret: string,
    payouts: PayoutQueue,
    private readonly basePrize: number
  ) {
    this.snapshot.payoutWallet = wallet.address.toBase58();
    this.ctx = {
      wallet,
      emit,
      masterSecret,
      payouts,
      basePrize,
      setState: (patch) => this.setState(patch),
    };
  }

  getSnapshot(): RoundStateDTO {
    return this.snapshot;
  }

  /**
   * Re-enqueue a settled round's unpaid winners.
   *
   * The recovery path for walletless play: a player who pasted an address has
   * no key of their own here, so if the background queue exhausted its retries
   * this is the only way the prize moves. The winners and their share are
   * re-read from storage rather than trusted from the caller, which is what
   * makes it safe to expose to anyone -- and `payOnce` re-checks `paid` inside
   * its transaction, so a redundant call sends nothing.
   */
  async retryPayouts(roundId: number): Promise<{ ok: true } | { ok: false; reason: string }> {
    const round = await getRound(roundId);
    if (!round) return { ok: false, reason: "That round doesn't exist yet." };
    if (round.phase !== "settled") return { ok: false, reason: "That round hasn't settled yet." };

    const sum = (round.diceA ?? 0) + (round.diceB ?? 0);
    // The share must be recomputed from the FULL winner list, not the unpaid
    // remainder -- dividing the prize among whoever is left would overpay the
    // stragglers and drain more than the round was ever worth.
    const everyone = await winnersFor(roundId, sum);
    if (everyone.length === 0) return { ok: false, reason: "That round had no winners." };
    const outstanding = await unpaidWinners(roundId, sum);
    if (outstanding.length === 0) return { ok: false, reason: "Every winner has already been paid." };

    this.ctx.payouts.enqueue(roundId, outstanding, Math.floor(round.prizeLamports / everyone.length));
    return { ok: true };
  }

  async run(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.cycle();
      } catch (err) {
        console.error("[roundLoop] round failed:", err);
        await sleep(5000);
      }
    }
  }

  private setState(patch: Partial<RoundStateDTO>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit.state(this.snapshot);
  }

  private get emit(): Emitter {
    return this.ctx.emit;
  }

  private async cycle(): Promise<void> {
    const state = await getState(this.basePrize);
    const round = state.currentRound > 0 ? await getRound(state.currentRound) : null;

    let roundId: number;
    let locksAtMs: number;
    let seed: Buffer | null;
    let wasOpen: boolean;

    if (!round || round.phase === "settled") {
      ({ roundId, locksAtMs, seed } = await openNewRound(this.ctx, state));
      wasOpen = true;
    } else if (round.phase === "open") {
      ({ roundId, locksAtMs, seed } = await resumeOpenRound(this.ctx, round, state));
      wasOpen = true;
    } else {
      console.log(`[roundLoop] resuming round ${round.roundId} in drawn phase; skipping to settle`);
      roundId = round.roundId;
      locksAtMs = round.locksAtMs;
      seed = null;
      wasOpen = false;
    }

    if (wasOpen) {
      if (Date.now() < locksAtMs) {
        await pickingPhase(this.ctx, roundId, locksAtMs);
      } else {
        this.setState({ phase: "locked", secondsLeft: 0 });
      }
    }

    const { diceSum, drawResultAt } = await drawAndSettle(this.ctx, roundId, state.numTiles, seed);
    // Sleep measured from `drawResultAt` (when the client's choreography clock
    // starts), not a flat delay after settle -- the client's draw sequence is
    // dynamic-length (a 12-step walk takes longer than a 2-step one). This is
    // what keeps the next round from opening mid-celebration.
    const readyAt = drawResultAt + drawSequenceDurationMs(diceSum) + DRAW_SEQUENCE_BUFFER_MS;
    await sleep(Math.max(0, readyAt - Date.now()));
  }
}

function emptySnapshot(): RoundStateDTO {
  return {
    roundId: 0,
    phase: "idle",
    secondsLeft: 0,
    locksAt: 0,
    locksAtWall: 0,
    durationSec: 0,
    prizeLamports: 0,
    numTiles: 40,
    guessCounts: {},
    commitHash: null,
    avatarTile: 0,
    landedTile: null,
    revealedSeed: null,
    winners: [],
    nextPrizeLamports: 0,
    onlineWallets: 0,
    payoutWallet: null,
  };
}
