"use client";

import { useCallback, useState } from "react";
import { audio } from "@/lib/audio";
import { useGame } from "./useGame";
import { useIdentity } from "./useIdentity";
import { useTokenGate } from "./useTokenGate";

/**
 * Ask the coordinator to place this round's guess for the pasted address.
 *
 * Nothing is signed here and no transaction is built. The player typed an
 * address rather than connecting a wallet, so they hold no key -- the
 * coordinator submits on their behalf and pays the fee and the pick account's
 * rent. The chain still verifies the address holds the game token, so this
 * path cannot let a non-holder in.
 *
 * Failure messages come straight from the server (`guessIntake.ts`), which
 * already phrases them for a player; re-wording them here would only let the
 * two drift apart.
 */
const RETRYABLE_RE = /didn't respond|not connected/i;
const MAX_TRIES = 3;
const BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useSubmitGuess(roundId: number | null) {
  const { ask } = useGame();
  const identity = useIdentity();
  const gate = useTokenGate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitGuess = useCallback(
    async (guessSum: number) => {
      if (roundId == null) return;
      if (!identity.address) {
        setError("Paste your wallet address first.");
        return;
      }
      // Mirrors the chain's own check so a non-holder is told why before the
      // coordinator spends a fee finding out. Not the security boundary.
      if (!gate.allowed) {
        setError("This address doesn't hold the game token.");
        return;
      }

      setError(null);
      setPending(true);
      try {
        for (let attempt = 0; ; attempt++) {
          const res = await ask("client:guess", { address: identity.address, sum: guessSum });
          if (res.ok) {
            audio.pick();
            return;
          }
          // Only transport failures are worth repeating. A rejection the
          // coordinator reasoned about -- gate, duplicate, rate limit -- will
          // say the same thing however many times it is asked.
          if (attempt >= MAX_TRIES - 1 || !RETRYABLE_RE.test(res.reason)) {
            setError(res.reason);
            return;
          }
          await sleep(BACKOFF_MS * 2 ** attempt);
        }
      } finally {
        setPending(false);
      }
    },
    [ask, roundId, identity.address, gate.allowed]
  );

  return { submitGuess, pending, error, gate };
}
