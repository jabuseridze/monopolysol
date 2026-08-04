import { RoundStateDTO } from "@monopoly-sol/shared";
import { GlobalConfigData, RoundData } from "./anchorCodec.js";
import { LoopCtx } from "./roundPhases.js";
import { makeRoundSecret, toHex } from "./seed.js";
import { readRoundSecret, writeRoundSecret } from "./secrets.js";

/**
 * Opening/resuming an `Open` round: persisting + reloading the commit-reveal
 * secret, and building the initial `RoundStateDTO` snapshot. Split out of
 * `roundPhases.ts` to keep each file focused (see that file's header).
 */

/** Persist the secret *before* opening on-chain, then open. Persisting first
 * is what makes resume-after-crash possible: if the process dies between the
 * write and the on-chain open call, the retry just opens (harmlessly
 * overwriting the unused secret); if it dies after, the secret needed to
 * reveal this round is already safe on disk. */
export async function openNewRound(
  ctx: LoopCtx,
  cfg: GlobalConfigData
): Promise<{ roundId: number; locksAtMs: number; seed: Buffer }> {
  const roundId = Number(cfg.currentRound) + 1;
  const secret = makeRoundSecret();
  writeRoundSecret(ctx.secretPath, {
    roundId,
    seedHex: secret.seed.toString("hex"),
    commitHex: toHex(secret.commitHash),
  });
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

/** Resume an `Open` round found on chain at startup, reloading its secret
 * from disk (written by `openNewRound` before the crash). */
export function resumeOpenRound(
  ctx: LoopCtx,
  round: RoundData,
  cfg: GlobalConfigData
): { roundId: number; locksAtMs: number; seed: Buffer } {
  const roundId = Number(round.roundId);
  const stored = readRoundSecret(ctx.secretPath);
  if (!stored || stored.roundId !== roundId) {
    throw new Error(
      `cannot resume round ${roundId}: no matching persisted secret at ${ctx.secretPath} ` +
        `(found ${stored ? `roundId=${stored.roundId}` : "nothing"})`
    );
  }
  const locksAtMs = Number(round.locksAt) * 1000;
  const nowMs = ctx.clock.now();
  ctx.setState(
    openSnapshot(roundId, round, cfg.numTiles, cfg.avatarPosition, stored.commitHex, nowMs)
  );
  console.log(
    `[roundLoop] resumed round ${roundId} in Open phase, ${Math.max(0, Math.ceil((locksAtMs - nowMs) / 1000))}s left`
  );
  return { roundId, locksAtMs, seed: Buffer.from(stored.seedHex, "hex") };
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
  return {
    roundId,
    phase: "open",
    secondsLeft: Math.max(0, Math.ceil((locksAtMs - nowMs) / 1000)),
    locksAt: locksAtMs,
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
