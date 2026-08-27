"use client";

import { useCallback, useState } from "react";
import { useGame } from "./useGame";

/**
 * Ask the coordinator to re-send a round's payouts.
 *
 * Replaces the old self-claim button, which needed a wallet signature the
 * player no longer has. It is a safety net, not the normal path: payouts are
 * automatic and a winner should never have to press anything. It exists because
 * a failed payout used to be logged once and forgotten, leaving money that was
 * owed and unreachable.
 *
 * Safe to expose to anyone: the server re-reads the winners from the chain
 * rather than trusting the caller, `payout` pins its destination to the pick's
 * own player, and `pick.claimed` makes a redundant send a no-op.
 */
export function useRetryPayout() {
  const { ask } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryPayout = useCallback(
    async (roundId: number) => {
      setError(null);
      setPending(true);
      try {
        const res = await ask("client:retryPayout", { roundId });
        if (!res.ok) setError(res.reason);
      } finally {
        setPending(false);
      }
    },
    [ask]
  );

  return { retryPayout, pending, error };
}
