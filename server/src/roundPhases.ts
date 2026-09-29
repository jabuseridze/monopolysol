import { ALARM_LEAD_SEC, RoundStateDTO } from "@monopoly-sol/shared";
import { landingFor, nextPrizeForLanding } from "@monopoly-sol/shared/effects";
import { guessCounts, winnersFor } from "./db/picks.js";
import { RoundRow, getRound, markSettled, recordDraw } from "./db/rounds.js";
import { Emitter } from "./emitter.js";
import { PayoutQueue } from "./payouts.js";
import { deriveDice, toHex } from "./seed.js";
import { Wallet } from "./wallet.js";

/** Per-phase handlers for the round loop. Kept out of `roundLoop.ts` (which
 * stays a thin orchestration/resume-dispatch shell) and out of `roundOpen.ts`
 * (which owns opening/resuming the `Open` phase specifically -- see its
 * header). This file owns the picking-window tick loop and the
 * reveal-through-payout tail. */
export interface LoopCtx {
  wallet: Wallet;
  emit: Emitter;
  /** Long-lived secret the per-round commit-reveal seed is derived from. */
  masterSecret: string;
  /** Winners are handed here and paid off the loop -- see `payouts.ts`. */
  payouts: PayoutQueue;
  /** Base the tile-effect prize ladder scales from. Without this the effects
   * reset every round to their hardcoded 0.5 SOL default, so a configured
   * base would silently apply to the first round only. */
  basePrize: number;
  setState: (patch: Partial<RoundStateDTO>) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tick loop for the picking window. Exits once the clock reaches
 * `locksAtMs`. */
export async function pickingPhase(ctx: LoopCtx, roundId: number, locksAtMs: number): Promise<void> {
  let cuedAlarm = false;
  let lastRefresh = 0;
  while (Date.now() < locksAtMs) {
    const secondsLeft = Math.max(0, Math.ceil((locksAtMs - Date.now()) / 1000));
    // Hand the client an absolute deadline rather than trusting it to count
    // down from an integer: a browser that sleeps a tab, or simply drifts,
    // would otherwise freeze short of zero or skip a block of seconds.
    ctx.emit.tick(roundId, secondsLeft, locksAtMs, "open");
    ctx.setState({ secondsLeft, locksAtWall: locksAtMs });

    if (!cuedAlarm && secondsLeft <= ALARM_LEAD_SEC) {
      cuedAlarm = true;
      ctx.emit.drawCue(roundId, ALARM_LEAD_SEC);
    }
    if (Date.now() - lastRefresh > 4000) {
      lastRefresh = Date.now();
      ctx.setState({ guessCounts: await guessCounts(roundId) });
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
 * Reveal (if not already revealed), settle, and hand winners to the payout
 * queue. `seed` is required unless the round is already past `open`.
 */
export async function drawAndSettle(
  ctx: LoopCtx,
  roundId: number,
  numTiles: number,
  seed: Buffer | null
): Promise<DrawOutcome> {
  let round = await getRound(roundId);
  if (!round) throw new Error(`round ${roundId} missing before reveal`);

  if (round.phase === "open") {
    if (!seed) {
      throw new Error(`round ${roundId} needs reveal but no seed is available`);
    }
    round = await reveal(ctx, round, seed, numTiles);
  }

  const diceA = round.diceA!;
  const diceB = round.diceB!;
  const landedTile = round.landedTile!;
  const winningSum = diceA + diceB;

  ctx.setState({
    phase: "drawing",
    landedTile,
    avatarTile: landedTile,
    revealedSeed: round.revealedSeed,
    nextPrizeLamports: round.nextPrizeLamports ?? 0,
  });
  const drawResultAt = Date.now();
  ctx.emit.drawResult(
    roundId,
    diceA,
    diceB,
    round.startTile,
    landedTile,
    round.revealedSeed!,
    round.commitHash
  );

  const winners = await winnersFor(roundId, winningSum);
  await markSettled(roundId);
  console.log(
    `[roundLoop] round ${roundId} settled: winning sum ${winningSum}, ${winners.length} winner(s)`
  );

  // Integer division, remainder left in the wallet: paying `ceil` to everyone
  // would spend more than the prize when the split is uneven.
  const prize = round.prizeLamports;
  const share = winners.length > 0 ? Math.floor(prize / winners.length) : 0;

  console.log(
    `[roundLoop] round ${roundId} complete: prize ${prize} lamports, share ${share} lamports/winner, ` +
      `next prize ${round.nextPrizeLamports} lamports`
  );

  // Announce the result BEFORE paying anyone. The winners and their share are
  // already known here, so making players wait on payout confirmations to find
  // out who won was pure latency -- and made the announcement arrive a full
  // second per winner late.
  ctx.setState({ phase: "settled", winners });
  ctx.emit.settled(roundId, landedTile, winners, prize, share);

  // Hand the payouts to the background queue and return. Nothing after this
  // point waits on them, so the next round opens on the choreography clock
  // rather than on however long it takes to pay thirty people.
  ctx.payouts.enqueue(roundId, winners, share);

  return { diceSum: winningSum, drawResultAt };
}

/**
 * Open the commit, roll the dice, walk the avatar, and arm the next prize.
 *
 * The dice are `keccak256(seed || round_id)` folded to two d6 -- the identical
 * derivation the program used, kept so a seed revealed today still verifies
 * against the same published algorithm. `nextPrizeForLanding` is the shared
 * pure function the Rust mirrored, so Random Pump, Get Rugged, Gas Fee,
 * Slippage Tax and the GO bonus all behave exactly as before.
 */
async function reveal(
  ctx: LoopCtx,
  round: RoundRow,
  seed: Buffer,
  numTiles: number
): Promise<RoundRow> {
  const { a, b, sum } = deriveDice(seed, BigInt(round.roundId));
  const { landedTile, passedOrLandedGo } = landingFor(round.startTile, sum, numTiles);
  const nextPrize = nextPrizeForLanding({
    landedTile,
    passedOrLandedGo,
    baseLamports: ctx.basePrize,
  });

  const updated = await recordDraw({
    roundId: round.roundId,
    revealedSeed: toHex(Array.from(seed)),
    diceA: a,
    diceB: b,
    landedTile,
    nextPrizeLamports: nextPrize,
  });
  console.log(
    `[roundLoop] round ${round.roundId} revealed: dice ${a}+${b}=${sum}, ` +
      `landed tile ${landedTile} (start ${round.startTile})`
  );
  return updated;
}
