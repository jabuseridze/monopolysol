"use client";

import { getTile } from "@monopoly-sol/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { useSelection } from "@/hooks/useSelection";

export function PickPanel() {
  const { round } = useGame();
  const { selected } = useSelection();
  const { connected } = useWallet();

  // TODO(Task 7): `selected` is still a tile index (old tile-lottery pick
  // flow) but `guessCounts` is keyed by dice-sum guess (2-12), not tile
  // index -- these no longer correspond. Task 7 owns rebuilding this panel
  // around guess pads instead of tile selection.
  const tile = selected != null ? getTile(selected) : undefined;
  const backers = selected != null ? round?.guessCounts?.[selected] ?? 0 : 0;
  const totalPicks = round
    ? Object.values(round.guessCounts).reduce((a: number, b: number) => a + b, 0)
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
