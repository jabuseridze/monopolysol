import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

/** Random Pump tile indices (#7, #22, #36) -- shared by every spec file that
 * needs to force a landing on one. */
export const PUMP_TILES = [7, 22, 36];

export async function airdrop(
  provider: anchor.AnchorProvider,
  kp: Keypair,
  sol = 2
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

/** Dice sum landing on any Random Pump tile from `startTile`, or null if none
 * of the three are reachable in a single roll (only 11/40 tiles ever are
 * from a given position). */
export function reachablePumpSum(startTile: number, numTiles: number): number | null {
  for (const t of PUMP_TILES) {
    const s = h.sumToReach(startTile, t, numTiles);
    if (s !== null) return s;
  }
  return null;
}

export interface RoundCtx {
  program: Program<Monopoly>;
  pid: PublicKey;
  config: PublicKey;
  authority: { publicKey: PublicKey };
  duration: number;
}

/**
 * Open a round forced to land on dice sum `sum`, have `guessers` submit
 * their guesses, sleep past the lock, then reveal. Round id always comes
 * from a fresh read of `config.currentRound` -- never hardcoded, since any
 * spec file may have already advanced the shared round counter.
 */
export async function openRevealRound(
  ctx: RoundCtx,
  sum: number,
  guessers: { kp: Keypair; guess: number }[] = []
): Promise<{ roundId: number; round: PublicKey }> {
  const { program, pid, config, authority, duration } = ctx;
  const treasury = h.treasuryPda(pid);
  const cfgNow = await program.account.globalConfig.fetch(config);
  const roundId = cfgNow.currentRound.toNumber() + 1;
  const seed = h.findSeedForDiceSum(roundId, sum);
  const round = h.roundPda(pid, roundId);

  await program.methods
    .openRound(h.commitOf(seed))
    .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
    .rpc();

  for (const g of guessers) {
    await program.methods
      .submitGuess(g.guess)
      .accounts({
        player: g.kp.publicKey,
        config,
        round,
        pick: h.pickPda(pid, roundId, g.kp.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([g.kp])
      .rpc();
  }

  await h.sleep(duration * 1000 + 500);

  await program.methods
    .revealAndDraw(Array.from(seed))
    .accounts({ authority: authority.publicKey, config, round })
    .rpc();

  return { roundId, round };
}
