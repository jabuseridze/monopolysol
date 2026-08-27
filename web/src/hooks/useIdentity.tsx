"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";

const STORE_KEY = "chain-estates:watch";

interface WatchCtx {
  watched: string | null;
  setWatched: (address: string | null) => void;
  /** Validation message for the last rejected input, or null. */
  error: string | null;
  /** False until the stored address has been read back from localStorage. */
  hydrated: boolean;
}

const Ctx = createContext<WatchCtx>({
  watched: null,
  setWatched: () => {},
  error: null,
  hydrated: false,
});

/**
 * Holds the address the player pasted. This is the game's only notion of
 * identity -- there is no wallet connection anywhere in the app.
 *
 * The player never signs. Guesses go to the coordinator over the socket and it
 * submits them on-chain, paying the fee and the pick account's rent. What keeps
 * that honest is that the *chain* checks the token gate against this address
 * (`token_gate.rs` reads the token account's own owner field), so a pasted
 * address can only play if it genuinely holds the coin, and prizes are pinned
 * on-chain to it.
 *
 * The trade-off, which is real and deliberate: anyone who knows an address can
 * ask the coordinator to guess for it, burning that address's one pick for the
 * round. They cannot steal the prize -- it still goes to the address -- but
 * they can stop someone picking their own number. Rate limits in
 * `server/src/guessIntake.ts` are the only mitigation.
 */
export function WatchProvider({ children }: { children: React.ReactNode }) {
  const [watched, setWatchedState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restored after mount, never during render: reading localStorage while
  // rendering would produce different markup on the server and the client.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORE_KEY);
      if (stored) setWatchedState(stored);
    } catch {
      /* private-mode Safari throws rather than returning null */
    } finally {
      // Set even on failure: "we looked" is what gates the landing screen, and
      // a storage error must not strand a returning player on it forever.
      setHydrated(true);
    }
  }, []);

  const setWatched = useCallback((address: string | null) => {
    if (!address) {
      setWatchedState(null);
      setError(null);
      try {
        window.localStorage.removeItem(STORE_KEY);
      } catch {
        /* ignored */
      }
      return;
    }
    const trimmed = address.trim();
    try {
      // Rejects both malformed base58 and 32-byte-looking strings that are not
      // valid points, so a typo is caught here rather than silently watching an
      // address that cannot exist.
      const key = new PublicKey(trimmed);
      setWatchedState(key.toBase58());
      setError(null);
      try {
        window.localStorage.setItem(STORE_KEY, key.toBase58());
      } catch {
        /* ignored */
      }
    } catch {
      setError("That doesn't look like a Solana address.");
    }
  }, []);

  const value = useMemo(
    () => ({ watched, setWatched, error, hydrated }),
    [watched, setWatched, error, hydrated]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface Identity {
  /** The pasted address, or null before one is entered. */
  address: string | null;
  /** Whether the player has entered an address at all. */
  ready: boolean;
  /**
   * Whether the stored address has been read yet.
   *
   * The landing screen keys off this: `watched` is null on the first render
   * even for a returning player, because localStorage can only be read after
   * mount. Without this flag every reload would flash the landing screen for
   * a frame before the saved address arrived.
   */
  hydrated: boolean;
}

export function useIdentity(): Identity {
  const { watched, hydrated } = useContext(Ctx);
  return useMemo(
    () => ({ address: watched, ready: watched !== null, hydrated }),
    [watched, hydrated]
  );
}

export function useWatch(): WatchCtx {
  return useContext(Ctx);
}
