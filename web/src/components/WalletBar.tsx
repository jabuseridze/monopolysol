"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";

export function WalletBar() {
  const { connected } = useWallet();
  const { sol, airdrop, airdropping, error } = useWalletBalance();

  return (
    <div
      className="panel"
      style={{ position: "absolute", top: 16, right: 16, padding: 12, display: "flex", gap: 10, alignItems: "center" }}
    >
      {connected && (
        <div style={{ textAlign: "right", lineHeight: 1.1 }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
            {sol == null ? "-" : sol.toFixed(3)} <span style={{ color: "var(--muted)" }}>SOL</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Devnet</div>
        </div>
      )}
      {connected && (
        <button className="btn ghost" onClick={airdrop} disabled={airdropping} title="Request 1 Devnet SOL">
          {airdropping ? "..." : "Faucet"}
        </button>
      )}
      <WalletMultiButton />
      {error && (
        <div style={{ position: "absolute", top: 62, right: 0, fontSize: 11, color: "#ffb3b3", width: 220, textAlign: "right" }}>
          {error}
        </div>
      )}
    </div>
  );
}
