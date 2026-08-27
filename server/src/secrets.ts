import { createHmac } from "node:crypto";
import sha3 from "js-sha3";

// Default import, not `{ keccak256 }` -- see the note in `seed.ts` for why
// named imports of js-sha3 resolve to undefined under Node's ESM loader.
const { keccak256 } = sha3;

/** A committed secret for one round: keep `seed` private until reveal. */
export interface RoundSecret {
  seed: Buffer; // 32 bytes
  commitHash: number[]; // keccak256(seed), 32 bytes
}

/**
 * The commit-reveal secret for a round, **derived rather than stored**.
 *
 * This used to be a random 32 bytes written to `.round-secret.json` before the
 * round opened, and read back to reveal. That made the coordinator stateful in
 * the one way it could not afford to be: on Render the filesystem is ephemeral,
 * so any redeploy landing mid-round destroyed the only copy of the preimage --
 * and without it the commit on-chain can never be opened. The round becomes
 * permanently unrevealable, players who guessed can never be paid, their pick
 * accounts can never be closed, and the round loop retries the same failed
 * reveal forever. That is not hypothetical: it happened twice in development,
 * once from a redeploy and once from deleting the file by hand.
 *
 * Deriving the seed from a long-lived secret removes the failure mode outright
 * rather than trying to store around it. Any process, at any time, can
 * recompute the seed for any round, so a restart is a non-event and the
 * coordinator is genuinely stateless.
 *
 * The security property is unchanged. HMAC-SHA256 is a PRF: without
 * `MASTER_SECRET` the output is indistinguishable from random, so players still
 * cannot predict a seed, and the commit is still published before guessing
 * opens. What changes is only *where* unpredictability comes from -- one
 * long-lived secret instead of a fresh random draw each round.
 *
 * The master secret is therefore as sensitive as the authority key: anyone
 * holding it can predict every future round. It belongs in a secret manager,
 * never in the repo, and rotating it is safe only between rounds (a rotation
 * mid-round strands that round's commit exactly as the old file loss did).
 */
export function roundSecret(masterSecret: string, roundId: number): RoundSecret {
  const seed = createHmac("sha256", masterSecret)
    .update(`round:${roundId}`)
    .digest();
  const commitHash = Array.from(Buffer.from(keccak256.arrayBuffer(seed)));
  return { seed, commitHash };
}
