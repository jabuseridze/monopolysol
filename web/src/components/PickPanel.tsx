"use client";

import { getTile } from "@monopoly-sol/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { useSelection } from "@/hooks/useSelection";

export function PickPanel() {
  const { round } = useGame();
  const { selected } = useSelection();
  const { connected } = useWallet();

  const tile = selected != null ? getTile(selected) : undefined;
  const backers = selected != null ? round?.pickCounts?.[selected] ?? 0 : 0;
  const totalPicks = round
    ? Object.values(round.pickCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="panel" style={{ position: "absolute", left: 16, bottom: 16, padding: 14, width: 260 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
        Your pick
      </div>
      {!connected ? (
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
          Connect a wallet, then click a property on the board to enter this round.
        </div>
      ) : tile ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{tile.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {backers} {backers === 1 ? "player" : "players"} on this tile
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
          Click any property to place your pick for round #{round?.roundId ?? "-"}.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        {totalPicks} total picks this round
      </div>
    </div>
  );
}
