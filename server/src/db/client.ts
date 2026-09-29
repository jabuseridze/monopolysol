import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

/**
 * The single Postgres pool, plus schema bootstrap.
 *
 * This database is not a cache -- it is where the game's state lives. It used
 * to live in Solana accounts, which meant a coordinator restart could rebuild
 * everything by reading the chain back. Nothing else does that job now, so a
 * round that is not written here is a round that a redeploy loses, along with
 * its guesses and the obligation to pay them.
 */
let pool: pg.Pool | null = null;

export function db(): pg.Pool {
  if (pool) return pool;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. The round loop cannot run without storage -- see server/src/db/schema.sql."
    );
  }

  pool = new Pool({
    connectionString: url,
    // Supabase and Render both terminate TLS with certificates that the
    // default verifier rejects (pooled connections are presented under a
    // shared hostname). `require: true` keeps the connection encrypted; only
    // the chain-of-trust check is relaxed.
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: false },
    // The round loop is one process doing a handful of small queries per
    // round. A large pool would just hold idle connections against Supabase's
    // per-project limit.
    max: 6,
    idleTimeoutMillis: 30_000,
  });

  // A pooled client can be killed by the server (Supabase recycles them). The
  // default behaviour for an error on an idle client is an uncaught exception
  // that takes the whole coordinator down mid-round.
  pool.on("error", (err) => {
    console.error("[db] idle client error (pool will reconnect):", err.message);
  });

  return pool;
}

function isLocal(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/** Create the tables if they do not exist. Safe on every boot. */
export async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  // `tsx` runs the TypeScript in place, so the .sql sits beside this file.
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  await db().query(sql);
  console.log("[db] schema ready");
}

/**
 * Run `fn` inside a transaction, rolling back if it throws.
 *
 * Used where a write and the action it records must not come apart -- above
 * all paying a winner and marking the pick paid. A transfer that succeeds
 * without its flag being set is a double payout waiting for the next retry.
 */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}
