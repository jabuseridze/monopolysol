import { RoundStateDTO } from "@monopoly-sol/shared";
import { GlobalConfigData, RoundData } from "./anchorCodec.js";
import { LoopCtx } from "./roundPhases.js";
import { toHex } from "./seed.js";
import { roundSecret } from "./secrets.js";

/**
 * Opening/resuming an `Open` round: persisting + reloading the commit-reveal
 * secret, and building the initial `RoundStateDTO` snapshot. Split out of
 * `roundPhases.ts` to keep each file focused (see that file's header).
 */

/** Derive this round's secret and open on-chain.
 *
 * Nothing is persisted: `roundSecret()` is a pure function of the master
 * secret and the round id, so a crash at any point here is recoverable simply
 * by deriving again. */
export async function openNewRound(
  ctx: LoopCtx,
  cfg: GlobalConfigData
): Promise<{ roundId: number; locksAtMs: number; seed: Buffer }> {
  const roundId = Number(cfg.currentRound) + 1;
  const secret = roundSecret(ctx.masterSecret, roundId);
  await ctx.chain.openRound(roundId, secret.commitHash);

  const round = await ctx.chain.getRound(roundId);
  if (!round) throw new Error(`round ${roundId} account missing after open`);
  const locksAtMs = Number(round.locksAt) * 1000;

  ctx.setState(
    openSnapshot(roundId, round, cfg.numTiles, cfg.avatarPosition, toHex(secret.commitHash), ctx.clock.now())
  );
  console.log(`[roundLoop] opened round ${roundId} (prize ${round.prizeLamports} lamports)`);
  return { roundId, locksAtMs, seed: secret.seed };
}

/** Resume an `Open` round found on chain at startup.
 *
 * Re-derives the secret rather than loading it. This is the case that used to
 * be fatal after a redeploy -- see `secrets.ts`. */
export function resumeOpenRound(
  ctx: LoopCtx,
  round: RoundData,
  cfg: GlobalConfigData
): { roundId: number; locksAtMs: number; seed: Buffer } {
  const roundId = Number(round.roundId);
  const secret = roundSecret(ctx.masterSecret, roundId);
  // A mismatch means the master secret is not the one this round was opened
  // with -- almost certainly a rotated or wrong `MASTER_SECRET`. Fail loudly
  // here rather than sending a reveal the program will reject as `BadReveal`.
  const onChainCommit = round.commitHash.toString("hex");
  if (toHex(secret.commitHash) !== onChainCommit) {
    throw new Error(
      `cannot resume round ${roundId}: derived commit does not match the chain. ` +
        `MASTER_SECRET is wrong or was rotated mid-round.`
    );
  }
  const locksAtMs = Number(round.locksAt) * 1000;
  const nowMs = ctx.clock.now();
  ctx.setState(
    openSnapshot(roundId, round, cfg.numTiles, cfg.avatarPosition, toHex(secret.commitHash), nowMs)
  );
  console.log(
    `[roundLoop] resumed round ${roundId} in Open phase, ${Math.max(0, Math.ceil((locksAtMs - nowMs) / 1000))}s left`
  );
  return { roundId, locksAtMs, seed: secret.seed };
}

function openSnapshot(
  roundId: number,
  round: RoundData,
  numTiles: number,
  avatarTile: number,
  commitHex: string,
  nowMs: number
): RoundStateDTO {
  const locksAtMs = Number(round.locksAt) * 1000;
  // `nowMs` is the caller's cluster-adjusted clock, so the difference against
  // real time is the live cluster offset -- enough to express the deadline in
  // the browser's own domain without threading the ClusterClock in here. The
  // picking loop re-broadcasts a fresher value every tick.
  const clusterOffsetMs = nowMs - Date.now();
  return {
    roundId,
    phase: "open",
    secondsLeft: Math.max(0, Math.ceil((locksAtMs - nowMs) / 1000)),
    locksAt: locksAtMs,
    locksAtWall: locksAtMs - clusterOffsetMs,
    durationSec: Math.max(1, Number(round.locksAt - round.openedAt)),
    prizeLamports: Number(round.prizeLamports),
    numTiles,
    guessCounts: {},
    commitHash: commitHex,
    avatarTile,
    landedTile: null,
    revealedSeed: null,
    winners: [],
    nextPrizeLamports: Number(round.nextPrizeLamports),
    onlineWallets: 0,
  };
}
