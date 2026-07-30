import { randomBytes } from "node:crypto";
import { keccak256 } from "js-sha3";
import { u64le } from "./pdas.js";

/** A committed secret for one round: keep `seed` private until reveal. */
export interface RoundSecret {
  seed: Buffer; // 32 bytes
  commitHash: number[]; // keccak256(seed), 32 bytes
}

export function makeRoundSecret(): RoundSecret {
  const seed = randomBytes(32);
  const commitHash = Array.from(
    Buffer.from(keccak256.arrayBuffer(seed))
  );
  return { seed, commitHash };
}

/** Reproduce the on-chain winning-tile derivation (for logging/verification). */
export function deriveWinningTile(
  seed: Buffer,
  roundId: number | bigint,
  numTiles: number
): number {
  const mix = Buffer.from(
    keccak256.arrayBuffer(Buffer.concat([seed, u64le(roundId)]))
  );
  const n = mix.readBigUInt64LE(0);
  return Number(n % BigInt(numTiles));
}

export const toHex = (b: Buffer | number[]): string =>
  Buffer.from(b as number[]).toString("hex");
