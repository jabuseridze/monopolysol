"use client";

import "@/lib/polyfills";

import { GameProvider } from "@/hooks/useGame";
import { SelectionProvider } from "@/hooks/useSelection";
import { WatchProvider } from "@/hooks/useIdentity";

/**
 * No wallet provider, by design.
 *
 * Players type an address instead of connecting a wallet, so there is nothing
 * to connect to and no `ConnectionProvider`/`WalletProvider` stack -- the
 * read-only RPC connection is a module singleton in `lib/connection.ts`.
 *
 * `WatchProvider` sits outside `GameProvider` because presence reports the
 * pasted address, so the game socket has to be able to read it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WatchProvider>
      <GameProvider>
        <SelectionProvider>{children}</SelectionProvider>
      </GameProvider>
    </WatchProvider>
  );
}
