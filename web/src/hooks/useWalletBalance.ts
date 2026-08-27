"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/connection";
import { useIdentity } from "./useIdentity";

export function useWalletBalance() {
  const { address } = useIdentity();
  const publicKey = useMemo(() => (address ? new PublicKey(address) : null), [address]);
  const [sol, setSol] = useState<number | null>(null);
  const [airdropping, setAirdropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setSol(lamports / LAMPORTS_PER_SOL);
    } catch {
      // A throttled or flaky RPC read must not take down the HUD; the next
      // poll will pick it up. Keep the last known figure on screen.
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
    // Every connected player polls this against the same RPC endpoint the
    // coordinator depends on, forever, whether or not they are looking at the
    // page. At 100 players a 15s interval is ~7 requests/second of pure
    // background noise competing with the game's own reads -- so poll less
    // often, and not at all while the tab is hidden.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    // Catch up immediately on return, so the pause is invisible to the player.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const airdrop = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    setAirdropping(true);
    try {
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      await refresh();
    } catch (e: any) {
      setError("Faucet limit hit. Try https://faucet.solana.com");
    } finally {
      setAirdropping(false);
    }
  }, [connection, publicKey, refresh]);

  return { sol, airdrop, airdropping, error, refresh };
}
