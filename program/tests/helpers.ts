import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { keccak256 } from "js-sha3";
import { Monopoly } from "../target/types/monopoly";

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

export function randomSeed(): Buffer {
  return Buffer.from(anchor.web3.Keypair.generate().secretKey.slice(0, 32));
}

/**
 * Reproduce the on-chain dice derivation for verification in tests:
 * `mix = keccak256(seed || round_id_le)`; die A is `mix[0..8]` as a little-endian
 * u64 mod 6 + 1, die B is the disjoint `mix[8..16]` window mod 6 + 1 (see
 * `reveal_and_draw.rs` -- the two dice deliberately read non-overlapping byte
 * windows of the same hash so they aren't correlated).
 */
export function expectedDice(
  seed: Buffer,
  roundId: number | bigint
): { a: number; b: number; sum: number } {
  const mix = Buffer.from(
    keccak256.arrayBuffer(Buffer.concat([seed, u64le(roundId)]))
  );
  const a = Number(mix.readBigUInt64LE(0) % 6n) + 1;
  const b = Number(mix.readBigUInt64LE(8) % 6n) + 1;
  return { a, b, sum: a + b };
}

/** Brute-force a seed whose derived dice sum equals `targetSum` (2..=12).
 * P(sum) per try is at best 1/36 (sum 2 or 12), so 100_000 tries fails with
 * effectively zero probability. */
export function findSeedForDiceSum(
  roundId: number,
  targetSum: number,
  maxTries = 100_000
): Buffer {
  for (let i = 0; i < maxTries; i++) {
    const seed = randomSeed();
    if (expectedDice(seed, roundId).sum === targetSum) return seed;
  }
  throw new Error(`Could not find a seed for dice sum ${targetSum}`);
}

/** Pure-math check (no brute force): the dice sum needed to land on
 * `targetTile` from `startTile`, or null if unreachable in a single roll.
 * Only 11 of `numTiles` tiles (position+2..position+12) are ever reachable
 * from a given position -- callers must check this before hunting a seed. */
export function sumToReach(
  startTile: number,
  targetTile: number,
  numTiles: number
): number | null {
  const sum = (((targetTile - startTile) % numTiles) + numTiles) % numTiles;
  return sum >= 2 && sum <= 12 ? sum : null;
}

/** Brute-force a seed that lands the avatar exactly on `targetTile` from
 * `startTile`. Throws if `targetTile` isn't reachable in one roll -- callers
 * should check `sumToReach` first (or pick a target known to be reachable). */
export function findSeedForLanding(
  roundId: number,
  startTile: number,
  targetTile: number,
  numTiles: number,
  maxTries = 100_000
): Buffer {
  const sum = sumToReach(startTile, targetTile, numTiles);
  if (sum === null) {
    throw new Error(`Tile ${targetTile} is not reachable from ${startTile} in one roll`);
  }
  return findSeedForDiceSum(roundId, sum, maxTries);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Idempotent initialize: fetches GlobalConfig, only calls `initialize` if it
 * doesn't exist yet. Lets both spec files call this from a `before()` hook
 * without assuming which file's test suite runs first (mocha globs
 * `tests/**\/*.ts` and sorts alphabetically, so `monopoly.errors.ts` actually
 * runs before `monopoly.ts`).
 */
export async function ensureInitialized(
  program: Program<Monopoly>,
  authority: { publicKey: PublicKey },
  prizeLamports: number,
  numTiles: number,
  roundDuration: number
): Promise<PublicKey> {
  const pid = program.programId;
  const config = configPda(pid);
  const treasury = treasuryPda(pid);
  const existing = await program.account.globalConfig.fetchNullable(config);
  if (!existing) {
    await program.methods
      .initialize(new anchor.BN(prizeLamports), numTiles, roundDuration)
      .accounts({
        authority: authority.publicKey,
        config,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
  return config;
}
