import fs from "node:fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

function loadAuthority(): Keypair {
  const inline = process.env.AUTHORITY_KEYPAIR;
  const path = process.env.AUTHORITY_KEYPAIR_PATH;
  let raw: string | undefined = inline;
  if (!raw && path) raw = fs.readFileSync(path, "utf8");
  if (!raw) {
    throw new Error(
      "Missing authority key. Set AUTHORITY_KEYPAIR (JSON array) or AUTHORITY_KEYPAIR_PATH."
    );
  }
  const bytes = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(bytes);
}

export interface AppConfig {
  rpcUrl: string;
  programId: PublicKey;
  /**
   * SPL mint a player must hold, or null when the gate is off. Only used to
   * derive the token account the guess instruction needs -- the chain is what
   * actually enforces holding, so a wrong value here fails the transaction
   * rather than letting anyone through.
   */
  gateMint: PublicKey | null;
  /** Ceiling on picks the coordinator will fund per round. */
  maxPicksPerRound: number;
  /** Refuse to fund picks below this authority balance, in SOL. */
  minAuthoritySol: number;
  /** Ceiling on guesses one socket may request per round. */
  maxGuessesPerSocket: number;
  authority: Keypair;
  port: number;
  /** Allowed browser origins for CORS (comma-separated in env). */
  corsOrigins: string[];
  /**
   * Long-lived secret every round's commit-reveal seed is derived from (see
   * `secrets.ts`). As sensitive as the authority key: whoever holds it can
   * predict every future roll.
   */
  masterSecret: string;
}

export function loadConfig(): AppConfig {
  const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.PROGRAM_ID ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
  );
  const port = Number(process.env.PORT ?? 4000);
  const rawGate = process.env.GATE_MINT?.trim();
  let gateMint: PublicKey | null = null;
  if (rawGate) {
    try {
      const k = new PublicKey(rawGate);
      gateMint = k.equals(PublicKey.default) ? null : k;
    } catch {
      // A typo must not take the coordinator down on boot; the chain still
      // enforces the real gate either way.
      console.warn(`[config] GATE_MINT is not a valid pubkey, gate treated as off: ${rawGate}`);
    }
  }
  const num = (v: string | undefined, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : dflt;
  };

  const corsOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
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
    programId,
    gateMint,
    maxPicksPerRound: num(process.env.MAX_PICKS_PER_ROUND, 500),
    minAuthoritySol: num(process.env.AUTHORITY_MIN_BALANCE_SOL, 1),
    maxGuessesPerSocket: num(process.env.MAX_GUESSES_PER_SOCKET, 5),
    authority: loadAuthority(),
    port,
    corsOrigins,
    masterSecret,
  };
}
