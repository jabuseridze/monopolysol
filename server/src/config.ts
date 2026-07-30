import fs from "node:fs";
import path from "node:path";
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
  authority: Keypair;
  port: number;
  /** Allowed browser origins for CORS (comma-separated in env). */
  corsOrigins: string[];
  /**
   * Where the in-flight round's commit-reveal secret is persisted (see
   * `secrets.ts`). Lets the round loop resume the same round after a crash
   * instead of losing the seed and stalling. Not committed -- see .gitignore.
   */
  roundSecretPath: string;
}

export function loadConfig(): AppConfig {
  const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.PROGRAM_ID ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
  );
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const roundSecretPath =
    process.env.ROUND_SECRET_PATH ?? path.resolve(process.cwd(), ".round-secret.json");

  return { rpcUrl, programId, authority: loadAuthority(), port, corsOrigins, roundSecretPath };
}
