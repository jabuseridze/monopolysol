import { PublicKey } from "@solana/web3.js";
import {
  SEED_CONFIG,
  SEED_PICK,
  SEED_ROUND,
  SEED_TREASURY,
} from "@monopoly-sol/shared";
import { PROGRAM_ID } from "./env";

const utf8 = (s: string) => new TextEncoder().encode(s);

/** u64 little-endian as Uint8Array (browser-safe, no Buffer). */
export function u64le(n: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(n), true);
  return out;
}

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([utf8(SEED_CONFIG)], PROGRAM_ID)[0];
}

export function treasuryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([utf8(SEED_TREASURY)], PROGRAM_ID)[0];
}

export function roundPda(roundId: number | bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [utf8(SEED_ROUND), u64le(roundId)],
    PROGRAM_ID
  )[0];
}

export function pickPda(roundId: number | bigint, player: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [utf8(SEED_PICK), u64le(roundId), player.toBytes()],
    PROGRAM_ID
  )[0];
}
