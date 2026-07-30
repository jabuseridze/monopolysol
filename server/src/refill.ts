import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ixDiscriminator } from "./anchorCodec.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { treasuryPda } from "./pdas.js";

/**
 * Manual/cron-triggered treasury top-up CLI. Not part of the round loop.
 *
 *   tsx src/refill.ts <amount-in-sol> [threshold-in-sol]
 *
 * Tops up by <amount-in-sol> if the current balance is below
 * <threshold-in-sol> (defaults to <amount-in-sol> if omitted). Tries a devnet
 * airdrop straight to the treasury PDA first (no funder keypair needed);
 * falls back to `fund_treasury` from the coordinator's own authority keypair
 * if the airdrop fails (e.g. rate-limited, or a cluster with no faucet).
 */
async function main(): Promise<void> {
  const amountSol = Number(process.argv[2]);
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    console.error("Usage: tsx src/refill.ts <amount-in-sol> [threshold-in-sol]");
    process.exit(1);
  }
  const thresholdSol = Number(process.argv[3] ?? amountSol);

  const cfg = loadConfig();
  const chain = new Chain(cfg);

  const beforeLamports = await chain.getTreasuryBalance();
  console.log(`[refill] treasury balance: ${beforeLamports / LAMPORTS_PER_SOL} SOL`);

  if (beforeLamports / LAMPORTS_PER_SOL >= thresholdSol) {
    console.log(`[refill] above threshold (${thresholdSol} SOL); nothing to do.`);
    return;
  }

  const amountLamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  await topUp(chain, amountLamports, amountSol);

  const afterLamports = await chain.getTreasuryBalance();
  console.log(`[refill] treasury balance now: ${afterLamports / LAMPORTS_PER_SOL} SOL`);
}

async function topUp(chain: Chain, amountLamports: number, amountSol: number): Promise<void> {
  try {
    const sig = await chain.connection.requestAirdrop(treasuryPda(chain.programId), amountLamports);
    await chain.connection.confirmTransaction(sig, "confirmed");
    console.log(`[refill] airdropped ${amountSol} SOL to treasury (sig ${sig})`);
  } catch (err) {
    console.warn("[refill] airdrop failed, falling back to fund_treasury:", err);
    const sig = await fundTreasury(chain, amountLamports);
    console.log(`[refill] funded treasury via fund_treasury (sig ${sig})`);
  }
}

/** Build + send `fund_treasury(amount)` from the coordinator's own authority
 * keypair (this CLI has no separate funder key configured). */
async function fundTreasury(chain: Chain, amountLamports: number): Promise<string> {
  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(BigInt(amountLamports));
  const data = Buffer.concat([ixDiscriminator("fund_treasury"), amount]);

  const ix = new TransactionInstruction({
    programId: chain.programId,
    keys: [
      { pubkey: chain.authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: treasuryPda(chain.programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = chain.authority.publicKey;
  const { blockhash } = await chain.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(chain.authority);
  const sig = await chain.connection.sendRawTransaction(tx.serialize());
  await chain.connection.confirmTransaction(sig, "confirmed");
  return sig;
}

main().catch((err) => {
  console.error("[refill] fatal:", err);
  process.exit(1);
});
