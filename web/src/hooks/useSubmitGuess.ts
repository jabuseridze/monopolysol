"use client";

import { useCallback, useState } from "react";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { buildSubmitGuessIx } from "@/lib/anchorClient";
import { audio } from "@/lib/audio";

/**
 * Matches only a duplicate-guess rejection -- the `pick` PDA's `init`
 * constraint fails with a message containing "already in use" when a wallet
 * tries to guess twice in the same round. Deliberately narrow: the old regex
 * (`/already in use|custom program error/i`) also matched any generic
 * `custom program error` -- including an unrelated failure like an unknown-
 * instruction error -- and mislabeled it as "you already guessed," showing
 * players a confident lie instead of the real error.
 */
const ALREADY_GUESSED_RE = /already in use/i;

export function useSubmitGuess(roundId: number | null) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitGuess = useCallback(
    async (guessSum: number) => {
      if (!publicKey || roundId == null) return;
      setError(null);
      setPending(true);
      try {
        const ix = buildSubmitGuessIx(publicKey, roundId, guessSum);
        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        audio.pick();
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setError(ALREADY_GUESSED_RE.test(msg) ? "You already guessed this round." : msg);
      } finally {
        setPending(false);
      }
    },
    [publicKey, roundId, connection, sendTransaction]
  );

  return { submitGuess, pending, error };
}
