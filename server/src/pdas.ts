import { PublicKey } from "@solana/web3.js";
import { SEED_CONFIG, SEED_PICK, SEED_ROUND, SEED_TREASURY } from "@monopoly-sol/shared";

/** u64 little-endian buffer, matching Rust `to_le_bytes()`. */
export function u64le(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEED_CONFIG)], programId)[0];
}

export function treasuryPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEED_TREASURY)], programId)[0];
}

export function roundPda(programId: PublicKey, roundId: number | bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ROUND), u64le(roundId)],
    programId
  )[0];
}

export function pickPda(
  programId: PublicKey,
  roundId: number | bigint,
  player: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_PICK), u64le(roundId), player.toBuffer()],
    programId
  )[0];
}
