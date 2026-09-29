import { db, tx } from "./client.js";

export interface PickRow {
  player: string;
  guess: number;
  paid: boolean;
}

/**
 * Record one guess. Returns false when this address already picked.
 *
 * The rejection comes from the primary key, not from a prior SELECT: two
 * requests for the same address can both pass a check-then-insert, and on a
 * shared prize that means one address holding two claims on the pot. On-chain
 * this was free -- the pick PDA was seeded on round+player, so the second
 * `init` simply failed.
 */
export async function insertPick(
  roundId: number,
  player: string,
  guess: number
): Promise<boolean> {
  const { rowCount } = await db().query(
    `INSERT INTO picks (round_id, player, guess)
     VALUES ($1, $2, $3)
     ON CONFLICT (round_id, player) DO NOTHING`,
    [roundId, player, guess]
  );
  return rowCount === 1;
}

/** `{ guessSum -> count }` for the live pad counters. */
export async function guessCounts(roundId: number): Promise<Record<number, number>> {
  const { rows } = await db().query(
    `SELECT guess, COUNT(*)::int AS n FROM picks WHERE round_id = $1 GROUP BY guess`,
    [roundId]
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[r.guess] = r.n;
  return out;
}

export async function pickCount(roundId: number): Promise<number> {
  const { rows } = await db().query(
    `SELECT COUNT(*)::int AS n FROM picks WHERE round_id = $1`,
    [roundId]
  );
  return rows[0].n;
}

/** Addresses that guessed `sum`, oldest first so payouts are deterministic. */
export async function winnersFor(roundId: number, sum: number): Promise<string[]> {
  const { rows } = await db().query(
    `SELECT player FROM picks WHERE round_id = $1 AND guess = $2 ORDER BY placed_at, player`,
    [roundId, sum]
  );
  return rows.map((r) => r.player);
}

/** Winners of `sum` who have not been paid yet -- the payout queue's worklist. */
export async function unpaidWinners(roundId: number, sum: number): Promise<string[]> {
  const { rows } = await db().query(
    `SELECT player FROM picks
      WHERE round_id = $1 AND guess = $2 AND NOT paid
      ORDER BY placed_at, player`,
    [roundId, sum]
  );
  return rows.map((r) => r.player);
}

/**
 * Claim a pick for payment, then run `send` and record the result atomically.
 *
 * `FOR UPDATE` plus the `NOT paid` guard is what makes a retry safe: a second
 * caller for the same pick blocks until this transaction ends and then sees
 * `paid = true`, so it sends nothing. This is the replacement for the on-chain
 * `claimed` flag, and it is the only thing standing between a retried payout
 * and paying someone twice.
 *
 * Returns the signature, or null when the pick was already paid.
 */
export async function payOnce(
  roundId: number,
  player: string,
  lamports: number,
  send: () => Promise<string>
): Promise<string | null> {
  return tx(async (c) => {
    const { rows } = await c.query(
      `SELECT paid FROM picks WHERE round_id = $1 AND player = $2 FOR UPDATE`,
      [roundId, player]
    );
    if (rows.length === 0 || rows[0].paid) return null;

    // If this throws the transaction rolls back and the pick stays unpaid, so
    // the next attempt tries again rather than silently dropping the prize.
    const sig = await send();

    await c.query(
      `UPDATE picks SET paid = TRUE, paid_sig = $3, lamports = $4
        WHERE round_id = $1 AND player = $2`,
      [roundId, player, sig, lamports]
    );
    return sig;
  });
}
