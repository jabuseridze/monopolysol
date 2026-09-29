import { PublicKey } from "@solana/web3.js";

/**
 * `?.trim() ||`, not `??`.
 *
 * `??` falls back only on null/undefined, so an env var set to an empty string
 * -- which is exactly what a hosting dashboard produces when someone saves a
 * blank field -- passes straight through. `new Connection("")` then throws
 * `Endpoint URL must start with http: or https:` during the static prerender,
 * failing the whole build with an error that names neither the variable nor
 * the file. `WS_URL` below always had the safe form; this was the odd one out.
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://api.devnet.solana.com";

/* `NEXT_PUBLIC_PROGRAM_ID` is deliberately gone. There is no on-chain program
   any more, so nothing derived an address from it -- leaving the variable in
   place would invite someone to set it and expect it to matter. */

/**
 * The coordinator. Everything a player does goes through it.
 *
 * The deployed URL is baked in rather than left to configuration. It used to
 * default to localhost, which meant a production build with the env var unset
 * told every visitor's browser to connect to port 4000 *on their own machine*
 * -- a failure with no error message, indistinguishable from the server being
 * down.
 *
 * `NODE_ENV` picks the target: `next dev` is "development" and still points at
 * a local coordinator, so nothing about local work changes. Note the env var is
 * read at BUILD time and inlined into the bundle, not read at runtime, so
 * changing it in Vercel requires a redeploy to take effect.
 *
 * `||` rather than `??` on purpose: an env var set to an empty string is a
 * common deployment slip and should fall back, not produce `io("")`.
 */
const DEFAULT_WS_URL =
  process.env.NODE_ENV === "production"
    ? "https://monopolysol.onrender.com"
    : "http://localhost:4000";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || DEFAULT_WS_URL;

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
