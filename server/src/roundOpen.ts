import { RoundStateDTO } from "@monopoly-sol/shared";
import { GameState, RoundRow, openRound } from "./db/rounds.js";
import { guessCounts } from "./db/picks.js";
import { LoopCtx } from "./roundPhases.js";
import { toHex } from "./seed.js";
import { roundSecret } from "./secrets.js";

/**
 * Opening/resuming an `Open` round: deriving the commit-reveal secret and
 * building the initial `RoundStateDTO` snapshot. Split out of
 * `roundPhases.ts` to keep each file focused (see that file's header).
 */

/** Derive this round's secret and open it.
 *
 * Nothing about the secret is persisted: `roundSecret()` is a pure function of
 * the master secret and the round id, so a crash at any point here is
 * recoverable simply by deriving again. */
export async function openNewRound(
  ctx: LoopCtx,
  state: GameState
): Promise<{ roundId: number; locksAtMs: number; seed: Buffer }> {
  const roundId = state.currentRound + 1;
  const secret = roundSecret(ctx.masterSecret, roundId);

  // The on-chain `open_round` refused to start a round the treasury could not
  // cover. Nothing enforces that for us now, so check it here: opening a round
  // the wallet cannot pay means taking guesses against a prize that will
  // bounce at settle time, which is worse than not opening at all.
  const balance = await ctx.wallet.balance();
  if (balance < state.nextPrizeLamports) {
    throw new Error(
      `payout wallet holds ${balance} lamports, below the ${state.nextPrizeLamports} prize; ` +
        `refusing to open round ${roundId}. Fund ${ctx.wallet.address.toBase58()}.`
    );
  }

  const locksAtMs = Date.now() + state.roundDurationSec * 1000;
  const round = await openRound({
    roundId,
    commitHash: toHex(secret.commitHash),
    startTile: state.avatarPosition,
    prizeLamports: state.nextPrizeLamports,
    locksAtMs,
  });

  ctx.setState(openSnapshot(round, state, {}, Date.now()));
  console.log(`[roundLoop] opened round ${roundId} (prize ${round.prizeLamports} lamports)`);
  return { roundId, locksAtMs, seed: secret.seed };
}

/** Resume an `Open` round found in the database at startup.
 *
 * Re-derives the secret rather than loading it. This is the case that used to
 * be fatal after a redeploy -- see `secrets.ts`. */
export async function resumeOpenRound(
  ctx: LoopCtx,
  round: RoundRow,
  state: GameState
): Promise<{ roundId: number; locksAtMs: number; seed: Buffer }> {
  const roundId = round.roundId;
  const secret = roundSecret(ctx.masterSecret, roundId);
  // A mismatch means the master secret is not the one this round was opened
  // with -- almost certainly a rotated or wrong `MASTER_SECRET`. Fail loudly
  // here rather than revealing a seed that does not open the published commit,
  // which is exactly the evidence a player would use to call the game rigged.
  if (toHex(secret.commitHash) !== round.commitHash) {
    throw new Error(
      `cannot resume round ${roundId}: derived commit does not match the stored one. ` +
        `MASTER_SECRET is wrong or was rotated mid-round.`
    );
  }

  // Guesses already placed have to come back with the round, or the pad
  // counters reset to zero on a redeploy and players think their pick was lost.
  const counts = await guessCounts(roundId);
  ctx.setState(openSnapshot(round, state, counts, Date.now()));
  console.log(
    `[roundLoop] resumed round ${roundId} in Open phase, ` +
      `${Math.max(0, Math.ceil((round.locksAtMs - Date.now()) / 1000))}s left`
  );
  return { roundId, locksAtMs: round.locksAtMs, seed: secret.seed };
}

function openSnapshot(
  round: RoundRow,
  state: GameState,
  guessCountsNow: Record<number, number>,
  nowMs: number
): Partial<RoundStateDTO> {
  return {
    roundId: round.roundId,
    phase: "open",
    secondsLeft: Math.max(0, Math.ceil((round.locksAtMs - nowMs) / 1000)),
    locksAt: Math.floor(round.locksAtMs / 1000),
    locksAtWall: round.locksAtMs,
    durationSec: state.roundDurationSec,
    prizeLamports: round.prizeLamports,
    numTiles: state.numTiles,
    guessCounts: guessCountsNow,
    commitHash: round.commitHash,
    avatarTile: round.startTile,
    landedTile: null,
    revealedSeed: null,
    winners: [],
  };
}
