import fs from "node:fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import { DEFAULT_PRIZE_LAMPORTS } from "@monopoly-sol/shared";
import dotenv from "dotenv";
import { decodeSecretKey } from "./bs58.js";

dotenv.config();

/**
 * The wallet prizes are sent from, and which the game is named after on
 * Solscan. `AUTHORITY_*` are still read so an existing deployment keeps
 * booting after the move off-chain without an env edit.
 */
function loadPayer(): Keypair {
  const inline = process.env.PAYOUT_KEYPAIR ?? process.env.AUTHORITY_KEYPAIR;
  const path = process.env.PAYOUT_KEYPAIR_PATH ?? process.env.AUTHORITY_KEYPAIR_PATH;
  let raw: string | undefined = inline;
  if (!raw && path) raw = fs.readFileSync(path, "utf8");
  if (!raw) {
    throw new Error(
      "Missing payout key. Set PAYOUT_KEYPAIR (JSON array or base58) or PAYOUT_KEYPAIR_PATH."
    );
  }
  return Keypair.fromSecretKey(decodeSecretKey(raw.trim()));
}

export interface AppConfig {
  rpcUrl: string;
  /** SPL mint a player must hold, or null when the gate is off. */
  gateMint: PublicKey | null;
  /** Ceiling on picks accepted per round. */
  maxPicksPerRound: number;
  /** Ceiling on guesses one socket may request per round. */
  maxGuessesPerSocket: number;
  /**
   * Prize for the very first round on a fresh database only. Afterwards the
   * stored value wins, because it carries the previous round's tile effect --
   * see `getState`.
   */
  basePrizeLamports: number;
  payer: Keypair;
  port: number;
  /** Allowed browser origins for CORS (comma-separated in env). */
  corsOrigins: string[];
  /**
   * Long-lived secret every round's commit-reveal seed is derived from (see
   * `secrets.ts`). As sensitive as the payout key: whoever holds it can
   * predict every future roll.
   */
  masterSecret: string;
}

export function loadConfig(): AppConfig {
  const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const port = Number(process.env.PORT ?? 4000);
  const rawGate = process.env.GATE_MINT?.trim();
  let gateMint: PublicKey | null = null;
  if (rawGate) {
    try {
      const k = new PublicKey(rawGate);
      gateMint = k.equals(PublicKey.default) ? null : k;
    } catch {
      // A typo must not take the coordinator down on boot.
      console.warn(`[config] GATE_MINT is not a valid pubkey, gate treated as off: ${rawGate}`);
    }
  }
  const num = (v: string | undefined, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : dflt;
  };

  // The deployed frontend is baked in alongside localhost so the two halves
  // find each other with no configuration. WEB_ORIGIN still wins when set --
  // it is how preview deployments, which each get their own URL, get let in.
  //
  // Trailing slashes are stripped: a browser's `Origin` header never carries
  // one, so "https://site.app/" pasted from the address bar matches nothing
  // and rejects every handshake with no error worth reading.
  const corsOrigins = (
    process.env.WEB_ORIGIN ??
    "http://localhost:3000,https://monopolysol-server.vercel.app"
  )
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  // Required, and deliberately without a default. A generated-on-boot fallback
  // would look like it worked and then strand every in-flight round on the next
  // restart -- exactly the failure this replaced. Better to refuse to start.
  const masterSecret = process.env.MASTER_SECRET?.trim();
  if (!masterSecret) {
    throw new Error(
      "MASTER_SECRET is required: it derives every round's commit-reveal seed. " +
        "Generate one with `openssl rand -hex 32` and set it in the environment. " +
        "Keep it secret and stable -- rotating it mid-round strands that round."
    );
  }
  if (masterSecret.length < 32) {
    throw new Error("MASTER_SECRET must be at least 32 characters of high-entropy random data.");
  }

  return {
    rpcUrl,
    gateMint,
    maxPicksPerRound: num(process.env.MAX_PICKS_PER_ROUND, 500),
    maxGuessesPerSocket: num(process.env.MAX_GUESSES_PER_SOCKET, 5),
    basePrizeLamports: num(process.env.BASE_PRIZE_LAMPORTS, DEFAULT_PRIZE_LAMPORTS),
    payer: loadPayer(),
    port,
    corsOrigins,
    masterSecret,
  };
}
