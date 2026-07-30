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
export async function pickingPhase(ctx: LoopCtx, roundId: number, locksAtMs: number): Promise<void> {
  let cuedAlarm = false;
  let lastRefresh = 0;
  let lastClockSync = 0;
  while (ctx.clock.now() < locksAtMs) {
    const secondsLeft = Math.max(0, Math.ceil((locksAtMs - ctx.clock.now()) / 1000));
    ctx.emit.tick(roundId, secondsLeft, "open");
    ctx.setState({ secondsLeft });

    if (!cuedAlarm && secondsLeft <= ALARM_LEAD_SEC) {
      cuedAlarm = true;
      ctx.emit.drawCue(roundId, ALARM_LEAD_SEC);
    }
    if (Date.now() - lastRefresh > 4000) {
      lastRefresh = Date.now();
      const { counts } = await ctx.chain.getPicks(roundId);
      ctx.setState({ pickCounts: counts }); // TODO(Task 5): rename to guessCounts
    }
    if (Date.now() - lastClockSync > 10000) {
      lastClockSync = Date.now();
      await ctx.clock.sync();
    }
    await sleep(1000);
  }
  ctx.setState({ phase: "locked", secondsLeft: 0 });
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
): Promise<void> {
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
  ctx.setState({ phase: "drawing", winningTile: round.landedTile, revealedSeed: seedHex });
  ctx.emit.drawResult(roundId, round.landedTile, seedHex, commitHex);

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
