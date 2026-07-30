"use client";

import { useCallback, useState } from "react";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { buildPickTileIx } from "@/lib/anchorClient";
import { audio } from "@/lib/audio";

export function usePickTile(roundId: number | null) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (tileIndex: number) => {
      if (!publicKey || roundId == null) return;
      setError(null);
      setPending(true);
      try {
        const ix = buildPickTileIx(publicKey, roundId, tileIndex);
        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        audio.pick();
      } catch (e: any) {
        // A duplicate pick (account already exists) is the common expected error.
        const msg = e?.message ?? String(e);
        setError(/already in use|custom program error/i.test(msg) ? "You already picked this round." : msg);
      } finally {
        setPending(false);
      }
    },
    [publicKey, roundId, connection, sendTransaction]
  );

  return { pick, pending, error };
}
