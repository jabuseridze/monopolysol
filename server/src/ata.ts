import { PublicKey } from "@solana/web3.js";

/** SPL Token program. */
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/**
 * The canonical associated token account for `owner` and `mint`.
 *
 * Derived here rather than pulled from `@solana/spl-token`, matching the
 * client-side copy in `web/src/lib/pdas.ts`: it is a fixed, documented
 * three-seed PDA, and the rest of this codebase deliberately hand-rolls its
 * Solana wire format instead of taking the dependency.
 *
 * Getting this wrong is not a security hole -- the program re-derives nothing
 * from it and `token_gate::enforce` validates the account's mint, owner and
 * balance from its own bytes -- so a bad address simply fails the gate.
 */
export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}
