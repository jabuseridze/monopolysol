"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/connection";
import { useIdentity } from "./useIdentity";
import { GATE_MINT } from "@/lib/env";
import { associatedTokenAddress } from "@/lib/pdas";

export interface TokenGate {
  /** False when no mint is configured -- the game is open to everyone. */
  enabled: boolean;
  /** Whole-token balance, or 0. Null while unknown (loading, or no wallet). */
  balance: number | null;
  /** Whether this wallet may currently submit a guess. */
  allowed: boolean;
  loading: boolean;
  /** The account the guess instruction must reference, or null when off. */
  tokenAccount: PublicKey | null;
  refresh: () => void;
}

/**
 * Mirrors the program's `token_gate::enforce` on the client, so a player who
 * cannot play is told why *before* signing rather than after a failed
 * transaction.
 *
 * This is a courtesy, not a security boundary -- the on-chain check is the
 * real one, and it must stay that way. Anyone can bypass this by building the
 * transaction themselves; they will simply be rejected by the program.
 */
export function useTokenGate(): TokenGate {
  const { address } = useIdentity();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const enabled = GATE_MINT !== null;
  const owner = useMemo(() => (address ? new PublicKey(address) : null), [address]);
  // Memoised, and that is load-bearing rather than an optimisation:
  // `associatedTokenAddress` returns a NEW PublicKey each call, and this value
  // is in the effect's dependency array below. Computed inline it changed
  // identity on every render, so the effect re-ran, flipped `loading`, caused
  // a re-render, and re-ran again -- an endless RPC fetch loop whose only
  // visible symptom was the gate status flickering between "checking" and
  // "held".
  const tokenAccount = useMemo(
    () => (enabled && owner ? associatedTokenAddress(owner, GATE_MINT!) : null),
    [enabled, owner]
  );

  useEffect(() => {
    if (!enabled || !owner || !tokenAccount) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    connection
      .getTokenAccountBalance(tokenAccount, "confirmed")
      .then((res) => {
        if (!cancelled) setBalance(Number(res.value.amount));
      })
      .catch(() => {
        // A wallet that has never held the token has no account at all, and
        // the RPC errors rather than returning zero. That is the single most
        // common case for a gated player, so it must read as "balance 0",
        // never as a failure the UI has to apologise for.
        if (!cancelled) setBalance(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, tokenAccount, enabled, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    enabled,
    balance,
    // Gate off, or a confirmed non-zero balance. Deliberately false while the
    // balance is still unknown, so the UI never briefly invites a click it is
    // about to reject.
    allowed: !enabled || (balance !== null && balance > 0),
    // Only "loading" while the answer is genuinely unknown. A `refresh()` after
    // a rejected guess re-checks a balance we already have, and reporting that
    // as loading would blink the status line back to "checking" for no reason
    // the player can see.
    loading: loading && balance === null,
    tokenAccount,
    refresh,
  };
}
