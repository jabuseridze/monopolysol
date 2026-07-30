import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { keccak256 } from "js-sha3";

const enc = (s: string) => Buffer.from(s);

/** u64 little-endian buffer, matching Rust `round_id.to_le_bytes()`. */
export function u64le(n: number | bigint): Buffer {
  return new anchor.BN(n.toString()).toArrayLike(Buffer, "le", 8);
}

export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc("config")], programId)[0];
}

export function treasuryPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc("treasury")], programId)[0];
}

export function roundPda(programId: PublicKey, roundId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc("round"), u64le(roundId)],
    programId
  )[0];
}

export function pickPda(
  programId: PublicKey,
  roundId: number,
  player: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc("pick"), u64le(roundId), player.toBuffer()],
    programId
  )[0];
}

/** keccak256(seed) as a 32-byte array (matches on-chain commit hash). */
export function commitOf(seed: Buffer): number[] {
  return Array.from(Buffer.from(keccak256.arrayBuffer(seed)));
}

/** Reproduce the on-chain winning-tile derivation for verification in tests. */
export function expectedWinningTile(
  seed: Buffer,
  roundId: number,
  numTiles: number
): number {
  const mix = Buffer.from(keccak256.arrayBuffer(Buffer.concat([seed, u64le(roundId)])));
  const n = mix.readBigUInt64LE(0);
  return Number(n % BigInt(numTiles));
}

export function randomSeed(): Buffer {
  return Buffer.from(anchor.web3.Keypair.generate().secretKey.slice(0, 32));
}

/** Brute-force a seed whose derived winning tile equals `targetTile`. */
export function findSeedForTile(
  roundId: number,
  numTiles: number,
  targetTile: number
): Buffer {
  for (let i = 0; i < 100_000; i++) {
    const seed = randomSeed();
    if (expectedWinningTile(seed, roundId, numTiles) === targetTile) return seed;
  }
  throw new Error("Could not find a seed for the target tile");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
