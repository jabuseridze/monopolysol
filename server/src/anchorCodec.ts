import { createHash } from "node:crypto";

/**
 * Minimal Anchor-compatible encoding/decoding so the coordinator can talk to
 * the program without a generated IDL file. Layouts MUST mirror the Rust
 * structs in `program/programs/monopoly/src/state.rs` field-for-field.
 */

/** Anchor global instruction discriminator = sha256("global:<name>")[..8]. */
export function ixDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

/** `Round.phase` enum tags, matching Rust's `Phase` declaration order. */
export const PHASE_OPEN = 0;
export const PHASE_DRAWN = 1;
export const PHASE_SETTLED = 2;

export interface GlobalConfigData {
  authority: Buffer; // 32 bytes
  prizeLamports: bigint;
  nextPrizeLamports: bigint;
  numTiles: number;
  roundDuration: number;
  currentRound: bigint;
  avatarPosition: number;
}

// GlobalConfig total account size (with 8-byte discriminator): 8 + 32 + 1 + 1
// + 8 + 8 + 2 + 4 + 8 + 2 = 74 bytes. If `state.rs` grows this struct without
// a matching edit here, decode offsets below silently drift.
export function decodeConfig(data: Buffer): GlobalConfigData {
  let o = 8; // skip discriminator
  const authority = data.subarray(o, o + 32);
  o += 32 + 1 + 1; // authority + config_bump + treasury_bump
  const prizeLamports = data.readBigUInt64LE(o); o += 8;
  const nextPrizeLamports = data.readBigUInt64LE(o); o += 8;
  const numTiles = data.readUInt16LE(o); o += 2;
  const roundDuration = data.readUInt32LE(o); o += 4;
  const currentRound = data.readBigUInt64LE(o); o += 8;
  const avatarPosition = data.readUInt16LE(o);
  return {
    authority,
    prizeLamports,
    nextPrizeLamports,
    numTiles,
    roundDuration,
    currentRound,
    avatarPosition,
  };
}

export interface RoundData {
  roundId: bigint;
  phase: number; // PHASE_OPEN | PHASE_DRAWN | PHASE_SETTLED
  commitHash: Buffer; // 32 bytes
  revealedSeed: Buffer; // 32 bytes, all-zero until revealed
  landedTile: number;
  winnersCount: number;
  totalPicks: number;
  prizeLamports: bigint;
  openedAt: bigint;
  locksAt: bigint;
  bump: number;
  diceA: number;
  diceB: number;
  startTile: number;
  nextPrizeLamports: bigint;
}

// Round total account size (with 8-byte discriminator): 8 + 8 + 1 + 32 + 32
// + 2 + 4 + 4 + 8 + 8 + 8 + 1 + 1 + 1 + 2 + 8 = 128 bytes. Keep in lockstep
// with `state.rs`'s `Round` struct field order.
export function decodeRound(data: Buffer): RoundData {
  let o = 8;
  const roundId = data.readBigUInt64LE(o); o += 8;
  const phase = data.readUInt8(o); o += 1;
  const commitHash = data.subarray(o, o + 32); o += 32;
  const revealedSeed = data.subarray(o, o + 32); o += 32;
  const landedTile = data.readUInt16LE(o); o += 2;
  const winnersCount = data.readUInt32LE(o); o += 4;
  const totalPicks = data.readUInt32LE(o); o += 4;
  const prizeLamports = data.readBigUInt64LE(o); o += 8;
  const openedAt = data.readBigInt64LE(o); o += 8;
  const locksAt = data.readBigInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  const diceA = data.readUInt8(o); o += 1;
  const diceB = data.readUInt8(o); o += 1;
  const startTile = data.readUInt16LE(o); o += 2;
  const nextPrizeLamports = data.readBigUInt64LE(o);
  return {
    roundId,
    phase,
    commitHash,
    revealedSeed,
    landedTile,
    winnersCount,
    totalPicks,
    prizeLamports,
    openedAt,
    locksAt,
    bump,
    diceA,
    diceB,
    startTile,
    nextPrizeLamports,
  };
}

/** Byte offsets into a PlayerPick account (after the 8-byte discriminator).
 * Total account size (with discriminator): 8 + 32 + 8 + 2 + 1 + 1 = 52 bytes
 * -- matches `chain.ts`'s `dataSize: 52` getProgramAccounts filter. */
export const PICK_OFFSETS = {
  player: 8,
  roundId: 8 + 32,
  guess: 8 + 32 + 8,
} as const;

export function decodePickPlayer(data: Buffer): Buffer {
  return data.subarray(PICK_OFFSETS.player, PICK_OFFSETS.player + 32);
}

export function decodePickGuess(data: Buffer): number {
  return data.readUInt16LE(PICK_OFFSETS.guess);
}
