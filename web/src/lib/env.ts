import { PublicKey } from "@solana/web3.js";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

/**
 * SPL mint a player must hold to play, or null when the gate is off.
 *
 * Unset means off, which is the default and matches the program's own
 * `gate_mint == Pubkey::default()` sentinel. This has to degrade gracefully:
 * the token does not exist yet, and the game must stay fully playable until
 * it does. An unparseable value is treated as off rather than crashing the
 * app on boot -- a typo here should not take the whole game down.
 */
export const GATE_MINT: PublicKey | null = (() => {
  const raw = process.env.NEXT_PUBLIC_GATE_MINT?.trim();
  if (!raw) return null;
  try {
    const key = new PublicKey(raw);
    return key.equals(PublicKey.default) ? null : key;
  } catch {
    console.warn(`[env] NEXT_PUBLIC_GATE_MINT is not a valid pubkey; gate disabled: ${raw}`);
    return null;
  }
})();
