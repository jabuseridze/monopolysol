import { DRAW_SEQUENCE_BUFFER_MS, drawSequenceDurationMs, RoundStateDTO } from "@monopoly-sol/shared";
import { PHASE_OPEN, PHASE_SETTLED } from "./anchorCodec.js";
import { Chain } from "./chain.js";
import { ClusterClock } from "./clusterClock.js";
import { Emitter } from "./emitter.js";
import { drawAndSettle, LoopCtx, pickingPhase } from "./roundPhases.js";
import { openNewRound, resumeOpenRound } from "./roundOpen.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Orchestration shell only -- per-phase logic lives in `roundOpen.ts` (open
 * / resume-open) and `roundPhases.ts` (picking tick loop, reveal-through-
 * payout). On every iteration (including after a recovered crash), `cycle()`
 * reads the *current* on-chain round instead of blindly opening a new one:
 *
 *   - phase Open,  now <  locksAt -> resume the picking-window tick loop
 *   - phase Open,  now >= locksAt -> skip straight to reveal
 *   - phase Drawn                 -> skip picking + reveal, go to settle + payout
 *   - phase Settled (or no round) -> open a new round
 *
 * This is what lets a `kill -9` mid-round resume the same round on restart
 * instead of orphaning it and opening a duplicate.
 *
 * Phase-boundary decisions use `ClusterClock` (`clusterClock.ts`), not raw
 * `Date.now()`: the program gates `reveal_and_draw` on the cluster's own
 * `Clock` sysvar, which can drift from host wall time (especially on a local
 * validator). `drawAndSettle()` in `roundPhases.ts` polls the real cluster
 * clock before firing the reveal tx, so this loop never speculatively fires
 * a reveal the program will reject.
 */
export class RoundLoop {
  private snapshot: RoundStateDTO = emptySnapshot();
  private readonly ctx: LoopCtx;

  constructor(private chain: Chain, private emit: Emitter, secretPath: string) {
    const clock = new ClusterClock(chain);
    this.ctx = { chain, emit, clock, secretPath, setState: (patch) => this.setState(patch) };
  }

  getSnapshot(): RoundStateDTO {
    return this.snapshot;
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

  private async cycle(): Promise<void> {
    await this.ctx.clock.sync();
    const cfg = await this.chain.getConfig();
    if (!cfg) {
      console.warn("[roundLoop] config not initialized; retrying...");
      await sleep(5000);
      return;
    }

    const currentRoundId = Number(cfg.currentRound);
    const round = currentRoundId > 0 ? await this.chain.getRound(currentRoundId) : null;

    let roundId: number;
    let locksAtMs: number;
    let seed: Buffer | null;
    let phase: number;

    if (!round || round.phase === PHASE_SETTLED) {
      const opened = await openNewRound(this.ctx, cfg);
      ({ roundId, locksAtMs, seed } = opened);
      phase = PHASE_OPEN;
    } else {
      roundId = currentRoundId;
      locksAtMs = Number(round.locksAt) * 1000;
      phase = round.phase;
      if (round.phase === PHASE_OPEN) {
        seed = resumeOpenRound(this.ctx, round, cfg).seed;
      } else {
        console.log(`[roundLoop] resuming round ${roundId} in Drawn phase; skipping to settle`);
        seed = null;
      }
    }

    if (phase === PHASE_OPEN) {
      if (this.ctx.clock.now() < locksAtMs) {
        await pickingPhase(this.ctx, roundId, locksAtMs);
      } else {
        this.setState({ phase: "locked", secondsLeft: 0 });
      }
    }

    const { diceSum, drawResultAt } = await drawAndSettle(this.ctx, roundId, cfg.numTiles, seed);
    // Sleep measured from `drawResultAt` (when the client's choreography
    // clock starts), not a flat delay tacked on after settle/payout -- the
    // client's draw sequence is dynamic-length (a 12-step walk takes longer
    // than a 2-step one), and settle/payout latency itself is variable. This
    // is what keeps the next round from ever opening mid-celebration
    // regardless of either source of variance.
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
  };
}
