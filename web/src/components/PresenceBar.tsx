"use client";

import { useGame } from "@/hooks/useGame";

/**
 * How many people are here, and how many have committed a guess.
 *
 * Previously a muted one-line footnote inside `PickPanel`, where it read as
 * incidental. These are the two numbers that tell a player the game is alive
 * and worth entering, so they get their own readout with the figures set
 * large and the words set small.
 *
 * Per-guess counts are NOT duplicated here -- they already render on each of
 * the eleven hologram pads (`PadChip.tsx`), which is where a player is looking
 * when the number matters.
 *
 * Must stay a direct child of `.overlay`: that container is
 * `pointer-events: none` and only its immediate children get pointer events
 * back. `Hud` returns a fragment, so rendering it there satisfies this.
 */
export function PresenceBar() {
  const { round, onlineWallets } = useGame();
  const totalGuesses = round
    ? Object.values(round.guessCounts).reduce((a: number, b: number) => a + b, 0)
    : 0;

  return (
    <div className="panel presence">
      <div className="panel-band band-gold">Table</div>
      <div className="presence-body">
      <div className="presence-stat">
        <span className="presence-dot" aria-hidden />
        <span className="presence-num">{onlineWallets}</span>
        <span className="presence-label">playing</span>
      </div>
      <div className="presence-sep" aria-hidden />
      <div className="presence-stat">
        <span className="presence-num">{totalGuesses}</span>
        <span className="presence-label">{totalGuesses === 1 ? "guess" : "guesses"}</span>
      </div>
      </div>
    </div>
  );
}
