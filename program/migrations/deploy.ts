/**
 * Anchor migration: after `anchor deploy`, run `anchor migrate` (or call this)
 * to initialize the global config + treasury and seed the treasury with SOL.
 * Safe to run once per fresh deployment.
 */
import * as anchor from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

const NUM_TILES = 40;
const PRIZE_LAMPORTS = LAMPORTS_PER_SOL / 2; // 0.5 SOL
// On-chain round_duration == the picking window. The coordinator adds the
// short draw-sequence afterward so the full player-facing cadence is ~120s.
const ROUND_DURATION = 105; // seconds
const INITIAL_FUNDING = 5 * LAMPORTS_PER_SOL;

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

  await program.methods
    .fundTreasury(new anchor.BN(INITIAL_FUNDING))
    .accounts({ funder: provider.wallet.publicKey, treasury, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`Funded treasury (${treasury.toBase58()}) with ${INITIAL_FUNDING} lamports`);
};
