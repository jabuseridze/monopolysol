import { PublicKey } from "@solana/web3.js";

/**
 * The SPL bits the token gate needs.
 *
 * Split out of the old `pdas.ts`, which also derived this game's own program
 * accounts. Those are gone -- the game no longer has an on-chain program -- but
 * the gate still reads a real SPL token account, which is standard Solana and
 * never depended on our program at all.
 */
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
