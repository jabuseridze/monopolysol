"use client";

import { useGame } from "@/hooks/useGame";
import { useSelection } from "@/hooks/useSelection";
import { useTokenGate } from "@/hooks/useTokenGate";
import { useIdentity } from "@/hooks/useIdentity";
import { GateNote } from "./GateNote";

export function PickPanel() {
  const { round } = useGame();
  const { selected: selectedSum } = useSelection();
  const { ready } = useIdentity();
  const gate = useTokenGate();

  // Round-wide totals moved to `PresenceBar`; this panel is only about the
  // guess the player is making right now.
  const backers = selectedSum != null ? round?.guessCounts?.[selectedSum] ?? 0 : 0;
  // The branch that already explains the requirement in full; the footnote
  // below stands down for it rather than repeating the same sentence twice.
  const blocked = ready && gate.enabled && !gate.allowed;

  return (
    <div className="panel pick-panel">
      <div className="panel-band band-crate">Your guess</div>
      <div className="panel-body">
      {!ready ? (
        <div className="panel-note">
          Paste your wallet address above, then click a glowing pad to guess the dice sum. No wallet connection needed.
        </div>
      ) : gate.enabled && !gate.allowed ? (
        // Only reachable when a gate mint is configured. Says what is wrong
        // and what would fix it, rather than leaving the pads mysteriously
        // inert -- the balance check is cheap and happens before any signing.
        <div style={{ marginTop: 6, fontSize: 14 }}>
          <div style={{ color: "var(--danger)", fontWeight: 700 }}>
            {gate.loading ? "Checking your balance..." : "Holders only"}
          </div>
          {!gate.loading && (
            <div className="panel-note" style={{ marginTop: 4 }}>
              You need to hold the game token in this wallet to play.
            </div>
          )}
        </div>
      ) : selectedSum != null ? (
        <>
          <div className="panel-figure pick-sum">Sum of {selectedSum}</div>
          <div className="panel-note">
            {backers} {backers === 1 ? "player" : "players"} on this guess
          </div>
        </>
      ) : (
        <div className="panel-note">
          Click a hologram pad to guess where the avatar lands, round #{round?.roundId ?? "-"}.
        </div>
      )}
      {/* States the entry requirement up front instead of only after a failed
          check. A newcomer who has pasted nothing was previously never told
          they need the coin at all -- which is the one thing that should send
          them to buy it. Suppressed in the blocked branch above, which already
          says it, and skipped entirely when no gate is configured. */}
      {gate.enabled && !blocked && <GateNote gate={gate} ready={ready} />}
      {/* Panning is right-drag in OrbitControls' default mapping, which no
          player will ever find on their own -- and the camera is locked during
          the draw, so the hint would be a lie outside the open phase. */}
      {round?.phase === "open" && (
        <div className="cam-hint">
          Drag to orbit · right-drag to move · double-click to reset
        </div>
      )}
      </div>
    </div>
  );
}
