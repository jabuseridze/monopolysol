import { ALARM_LEAD_SEC, RoundStateDTO } from "@monopoly-sol/shared";
import { landingFor } from "@monopoly-sol/shared/effects";
import { PHASE_OPEN, RoundData } from "./anchorCodec.js";
import { Chain } from "./chain.js";
import { ClusterClock } from "./clusterClock.js";
import { Emitter } from "./emitter.js";
import { deriveDice } from "./seed.js";

/** Per-phase handlers for the round loop. Kept out of `roundLoop.ts` (which
 * stays a thin orchestration/resume-dispatch shell) and out of `roundOpen.ts`
 * (which owns opening/resuming the `Open` phase specifically -- see its
 * header). This file owns the picking-window tick loop and the
 * reveal-through-payout tail. */
export interface LoopCtx {
  chain: Chain;
  emit: Emitter;
  clock: ClusterClock;
  secretPath: string;
  setState: (patch: Partial<RoundStateDTO>) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tick loop for the picking window. Exits once the (cluster-adjusted) clock
 * reaches `locksAtMs`. Re-syncs the clock periodically so a long picking
 * window doesn't drift on a stale offset. */
/** Once inside this many seconds of the lock, re-sync the cluster clock on the
 * tighter cadence below. The wall-clock deadline the client counts down to is
 * only as good as the offset it was derived from, and the last few seconds are
 * exactly where an inaccurate deadline is visible. */
const ENDGAME_SEC = 15;
const CLOCK_SYNC_MS = 10_000;
const CLOCK_SYNC_ENDGAME_MS = 2_000;

export async function pickingPhase(ctx: LoopCtx, roundId: number, locksAtMs: number): Promise<void> {
  let cuedAlarm = false;
  let lastRefresh = 0;
  let lastClockSync = 0;
  while (ctx.clock.now() < locksAtMs) {
    const secondsLeft = Math.max(0, Math.ceil((locksAtMs - ctx.clock.now()) / 1000));
    // Hand the client an absolute deadline in its OWN clock domain rather
    // than trusting it to count down from an integer. `secondsLeft` here is
    // measured against the cluster clock, which can run at a different rate
    // from wall time -- so this loop's own sense of "seconds remaining" jumps
    // whenever the offset is re-synced, and a client echoing it would skip a
    // block of seconds and then freeze short of zero.
    const locksAtWall = ctx.clock.toWallMs(locksAtMs);
    ctx.emit.tick(roundId, secondsLeft, locksAtWall, "open");
    ctx.setState({ secondsLeft, locksAtWall });

    if (!cuedAlarm && secondsLeft <= ALARM_LEAD_SEC) {
      cuedAlarm = true;
      ctx.emit.drawCue(roundId, ALARM_LEAD_SEC);
    }
    if (Date.now() - lastRefresh > 4000) {
      lastRefresh = Date.now();
      const { counts } = await ctx.chain.getPicks(roundId);
      ctx.setState({ guessCounts: counts });
    }
    const syncEvery = secondsLeft <= ENDGAME_SEC ? CLOCK_SYNC_ENDGAME_MS : CLOCK_SYNC_MS;
    if (Date.now() - lastClockSync > syncEvery) {
      lastClockSync = Date.now();
      await ctx.clock.sync();
    }
    await sleep(1000);
  }
  ctx.setState({ phase: "locked", secondsLeft: 0, locksAtWall: Date.now() });
}

/** Dice sum + the wall-clock moment `drawResult` was emitted -- the caller
 * (`roundLoop.ts`) uses both to size the post-draw sleep so the next round
 * never opens mid-celebration, however long this round's payout loop took. */
export interface DrawOutcome {
  diceSum: number;
  drawResultAt: number;
}

/**
 * Reveal (if not already revealed), cross-check the chain's dice/landing
 * against a local recomputation, settle, and pay out winners. `seed` is
 * required unless the round is already past `Open` (resumed at `Drawn`,
 * where the seed is already revealed on-chain).
 */
export async function drawAndSettle(
  ctx: LoopCtx,
  roundId: number,
  numTiles: number,
  seed: Buffer | null
): Promise<DrawOutcome> {
  let round = await ctx.chain.getRound(roundId);
  if (!round) throw new Error(`round ${roundId} missing before reveal`);

  if (round.phase === PHASE_OPEN) {
    if (!seed) {
      throw new Error(
        `round ${roundId} needs reveal but no seed is available (resumed without a persisted secret)`
      );
    }
    // `reveal_and_draw.rs` gates on the *cluster* clock, not wall time -- wait
    // for the chain's own clock to actually reach `locksAt` before firing the
    // tx, rather than guessing from `Date.now()` and retrying on rejection.
    await ctx.clock.waitUntil(Number(round.locksAt) * 1000);
    await ctx.chain.revealAndDraw(roundId, seed);
    round = await ctx.chain.getRound(roundId);
    if (!round) throw new Error(`round ${roundId} missing after reveal`);
    console.log(
      `[roundLoop] round ${roundId} revealed: dice ${round.diceA}+${round.diceB}=` +
        `${round.diceA + round.diceB}, landed tile ${round.landedTile} (start ${round.startTile})`
    );
  }

  assertDiceAgree(round, numTiles);

  const seedHex = round.revealedSeed.toString("hex");
  const commitHex = round.commitHash.toString("hex");
  ctx.setState({
    phase: "drawing",
    landedTile: round.landedTile,
    avatarTile: round.landedTile,
    revealedSeed: seedHex,
    nextPrizeLamports: Number(round.nextPrizeLamports),
  });
  const drawResultAt = Date.now();
  ctx.emit.drawResult(
    roundId,
    round.diceA,
    round.diceB,
    round.startTile,
    round.landedTile,
    seedHex,
    commitHex
  );

  const winningSum = round.diceA + round.diceB;
  const { byGuess } = await ctx.chain.getPicks(roundId);
  const winners = byGuess[winningSum] ?? [];
  await ctx.chain.settle(roundId, winners.length);
  console.log(
    `[roundLoop] round ${roundId} settled: winning sum ${winningSum}, ${winners.length} winner(s)`
  );

  const prize = Number(round.prizeLamports);
  const share = winners.length > 0 ? Math.floor(prize / winners.length) : 0;
  let lastSig: string | null = null;
  for (const w of winners) {
    try {
      lastSig = await ctx.chain.payout(roundId, w);
    } catch (e) {
      console.error("[roundLoop] payout failed for", w.toBase58(), e);
    }
  }

  const winnerStrs = winners.map((w) => w.toBase58());
  console.log(
    `[roundLoop] round ${roundId} complete: prize ${prize} lamports, share ${share} lamports/winner, ` +
      `next prize ${round.nextPrizeLamports} lamports`
  );
  ctx.setState({ phase: "settled", winners: winnerStrs });
  ctx.emit.settled(roundId, round.landedTile, winnerStrs, prize, share, lastSig);

  return { diceSum: winningSum, drawResultAt };
}

/** Turns a would-be silent treasury-overpay (wrong winner bucket) into a loud
 * crash: recompute dice + landing locally from the chain-revealed seed and
 * compare against what the chain itself reported. */
function assertDiceAgree(round: RoundData, numTiles: number): void {
  const local = deriveDice(round.revealedSeed, round.roundId);
  const landing = landingFor(round.startTile, local.sum, numTiles);
  if (local.a !== round.diceA || local.b !== round.diceB || landing.landedTile !== round.landedTile) {
    throw new Error(
      `dice/landing mismatch for round ${round.roundId}: ` +
        `chain(a=${round.diceA}, b=${round.diceB}, landed=${round.landedTile}) vs ` +
        `local(a=${local.a}, b=${local.b}, landed=${landing.landedTile})`
    );
  }
}
