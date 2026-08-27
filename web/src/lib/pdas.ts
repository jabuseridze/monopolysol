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

/** SPL Token program. */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/**
 * The canonical associated token account for `owner` and `mint`.
 *
 * Derived here rather than pulled from `@solana/spl-token` on purpose: that
 * package is large and this app deliberately hand-rolls its Solana wire
 * format (see `anchorClient.ts`, which precomputes a discriminator rather
 * than bundling a hasher). The derivation is a fixed, documented three-seed
 * PDA and is not going to change.
 */
export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}
