import { randomBytes } from "node:crypto";
// Default import, not `{ keccak256 }`: under Node's native ESM loader,
// cjs-module-lexer fails to statically detect js-sha3's named exports (it
// builds `module.exports` non-statically), so a named import resolves to
// undefined at runtime even though it typechecks. The default import always
// works because Node always exposes the whole CJS `module.exports` as it.
import sha3 from "js-sha3";
import { u64le } from "./pdas.js";

const { keccak256 } = sha3;

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

/**
 * Reproduce the on-chain dice derivation (`reveal_and_draw.rs`) for the
 * chain-vs-local cross-check in `roundPhases.ts`: two disjoint 8-byte windows
 * of `keccak256(seed || round_id_le)`, each folded to 1..=6. The windows must
 * stay disjoint -- deriving `b` by shifting `a`'s window would correlate the
 * two dice, unlike the program.
 */
export function deriveDice(
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

export const toHex = (b: Buffer | number[]): string =>
  Buffer.from(b as number[]).toString("hex");
