import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ixDiscriminator } from "./anchorCodec.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { configPda, treasuryPda } from "./pdas.js";

/**
 * Manual treasury withdrawal CLI. The mirror of `refill.ts`, and deliberately
 * not wired into the round loop or exposed over the socket -- moving the prize
 * pot is an operator action, not something a running server should ever do on
 * its own.
 *
 *   tsx src/withdraw.ts <destination-address> [amount-in-sol]
 *
 * Omitting the amount withdraws everything above the account's rent floor.
 * Signed by the coordinator's authority keypair, which the program requires.
 */
async function main(): Promise<void> {
  const destinationRaw = process.argv[2];
  if (!destinationRaw) {
    console.error("Usage: tsx src/withdraw.ts <destination-address> [amount-in-sol]");
    process.exit(1);
  }

  let destination: PublicKey;
  try {
    destination = new PublicKey(destinationRaw);
  } catch {
    console.error(`[withdraw] not a valid Solana address: ${destinationRaw}`);
    process.exit(1);
  }

  // `0` is the program's sentinel for "everything available", so an omitted
  // amount maps onto it directly rather than needing a separate code path.
  const amountArg = process.argv[3];
  let amountLamports = 0;
  if (amountArg !== undefined) {
    const amountSol = Number(amountArg);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      console.error("[withdraw] amount must be a positive number of SOL");
      process.exit(1);
    }
    amountLamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  }

  const cfg = loadConfig();
  const chain = new Chain(cfg);

  const before = await chain.getTreasuryBalance();
  console.log(`[withdraw] treasury balance: ${before / LAMPORTS_PER_SOL} SOL`);
  console.log(
    `[withdraw] sending ${amountArg === undefined ? "everything available" : `${amountArg} SOL`} to ${destination.toBase58()}`
  );

  const sig = await withdraw(chain, destination, amountLamports);
  console.log(`[withdraw] done (sig ${sig})`);

  const after = await chain.getTreasuryBalance();
  console.log(`[withdraw] treasury balance now: ${after / LAMPORTS_PER_SOL} SOL`);
}

/** Build + send `withdraw_treasury(amount)`, signed by the authority. */
async function withdraw(
  chain: Chain,
  destination: PublicKey,
  amountLamports: number
): Promise<string> {
  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(BigInt(amountLamports));
  const data = Buffer.concat([ixDiscriminator("withdraw_treasury"), amount]);

  // Account order must match `WithdrawTreasury` in the Rust exactly; there is
  // no generated client here, so this list is maintained by hand.
  const ix = new TransactionInstruction({
    programId: chain.programId,
    keys: [
      { pubkey: chain.authority.publicKey, isSigner: true, isWritable: false },
      { pubkey: configPda(chain.programId), isSigner: false, isWritable: false },
      { pubkey: treasuryPda(chain.programId), isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
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
  console.error("[withdraw] fatal:", err);
  process.exit(1);
});
