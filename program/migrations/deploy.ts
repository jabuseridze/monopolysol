/**
 * Anchor migration: after `anchor deploy`, run `anchor migrate` (or call this)
 * to initialize the global config + treasury and seed the treasury with SOL.
 * Safe to run once per fresh deployment.
 */
import * as anchor from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

const NUM_TILES = 40;
const PRIZE_LAMPORTS = LAMPORTS_PER_SOL / 2; // 0.5 SOL
// On-chain round_duration == the picking WINDOW, not the whole cycle: the
// coordinator adds the draw sequence (12.3-16.1s of dice + walk + celebration)
// on top. 100s of guessing therefore yields a ~116-120s round.
//
// There is no instruction to change this after `initialize` -- see lib.rs, which
// exposes no config setter -- so the only way to retune it is a fresh chain.
// Override for fast iteration: `ROUND_DURATION=15 anchor migrate`.
const ROUND_DURATION = Number(process.env.ROUND_DURATION ?? 100); // seconds
const INITIAL_FUNDING = 20 * LAMPORTS_PER_SOL;

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  const program = anchor.workspace.monopoly as anchor.Program;
  const pid = program.programId;

  const [config] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
  const [treasury] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("treasury")], pid);

  const existing = await provider.connection.getAccountInfo(config);
  if (!existing) {
    await program.methods
      .initialize(new anchor.BN(PRIZE_LAMPORTS), NUM_TILES, ROUND_DURATION)
      .accounts({
        authority: provider.wallet.publicKey,
        config,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Initialized config:", config.toBase58());
  } else {
    console.log("Config already initialized; skipping.");
  }

  // Re-running migrate() shouldn't silently top up devnet SOL every time; only
  // re-fund when explicitly requested.
  if (process.env.FORCE_REFUND === "1") {
    await program.methods
      .fundTreasury(new anchor.BN(INITIAL_FUNDING))
      .accounts({ funder: provider.wallet.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`Funded treasury (${treasury.toBase58()}) with ${INITIAL_FUNDING} lamports`);
  } else {
    console.log("Skipping treasury fund (set FORCE_REFUND=1 to re-fund).");
  }
};
