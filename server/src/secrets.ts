import fs from "node:fs";

/**
 * The commit-reveal secret for the round currently in flight, persisted to
 * disk before `openRound()` is called so a crash mid-round doesn't strand an
 * on-chain `Open`/`Drawn` round with an unrecoverable seed. See
 * `roundPhases.ts` for how this is used to resume after a restart.
 */
export interface RoundSecretRecord {
  roundId: number;
  seedHex: string;
  commitHex: string;
}

/** Returns null if no secret file exists yet (fresh install / already settled). */
export function readRoundSecret(path: string): RoundSecretRecord | null {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as RoundSecretRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

export function writeRoundSecret(path: string, record: RoundSecretRecord): void {
  fs.writeFileSync(path, JSON.stringify(record, null, 2));
}
