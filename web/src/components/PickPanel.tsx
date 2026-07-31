"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { useSelection } from "@/hooks/useSelection";

export function PickPanel() {
  const { round, onlineWallets } = useGame();
  const { selected: selectedSum } = useSelection();
  const { connected } = useWallet();

  const backers = selectedSum != null ? round?.guessCounts?.[selectedSum] ?? 0 : 0;
  const totalGuesses = round
    ? Object.values(round.guessCounts).reduce((a: number, b: number) => a + b, 0)
    : 0;

  return (
    <div className="panel" style={{ position: "absolute", left: 16, bottom: 16, padding: 14, width: 260 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
        Your guess
      </div>
      {!connected ? (
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
          Connect a wallet, then click a glowing pad to guess the dice sum.
        </div>
      ) : selectedSum != null ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Sum of {selectedSum}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {backers} {backers === 1 ? "player" : "players"} on this guess
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
          Click a hologram pad to guess where the avatar lands, round #{round?.roundId ?? "-"}.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        {totalGuesses} total guesses this round · {onlineWallets} online
      </div>
    </div>
  );
}
