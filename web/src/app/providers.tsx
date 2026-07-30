"use client";

import "@/lib/polyfills";
import "@solana/wallet-adapter-react-ui/styles.css";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "@/lib/env";
import { GameProvider } from "@/hooks/useGame";
import { SelectionProvider } from "@/hooks/useSelection";

export function Providers({ children }: { children: React.ReactNode }) {
  // Phantom, Solflare, etc. are auto-detected via the Wallet Standard, so no
  // explicit adapter list is needed.
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <GameProvider>
            <SelectionProvider>{children}</SelectionProvider>
          </GameProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
