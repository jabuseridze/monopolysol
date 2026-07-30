"use client";

import { useCallback, useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export function useWalletBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [airdropping, setAirdropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    const lamports = await connection.getBalance(publicKey, "confirmed");
    setSol(lamports / LAMPORTS_PER_SOL);
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
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
