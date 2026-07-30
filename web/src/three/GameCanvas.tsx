"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { usePickTile } from "@/hooks/usePickTile";
import { useSelection } from "@/hooks/useSelection";
import { audio } from "@/lib/audio";
import { Scene } from "./Scene";
import { BoardView } from "./viewTypes";

export function GameCanvas() {
  const { round, drawCue, drawResult, settled } = useGame();
  const { publicKey } = useWallet();
  const roundId = round?.roundId ?? null;
  const { pick } = usePickTile(roundId);
  const { selected, setSelected } = useSelection();

  // Reset the local selection whenever a new round starts.
  useEffect(() => setSelected(null), [roundId]);

  // Audio cues driven by server events.
  useEffect(() => {
    if (drawCue) audio.alarm();
  }, [drawCue?.at]);
  useEffect(() => {
    if (settled && publicKey && settled.winners.includes(publicKey.toBase58())) {
      audio.win();
    }
  }, [settled?.at]);

  // Countdown blip is disabled for now (kept wired up so it's a one-line
  // re-enable): uncomment the audio.blip() call below to bring it back.
  const lastBlip = useRef(0);
  useEffect(() => {
    const s = round?.secondsLeft ?? 99;
    if (round?.phase === "open" && s <= 5 && s > 0 && s !== lastBlip.current) {
      lastBlip.current = s;
      // audio.blip();
    }
  }, [round?.secondsLeft, round?.phase]);

  const view: BoardView = useMemo(() => {
    const phase = round?.phase ?? "idle";
    const drawn = phase === "drawing" || phase === "settled";
    return {
      phase,
      // TODO(Task 7): `guessCounts` is keyed by dice-sum guess (2-12), not
      // tile index -- `Board`/`Tile` still index this by tile.index below,
      // which no longer lines up under the dice-walk mechanic. Left as a
      // mechanical rename only; Task 7 owns the guess-pad UI rebuild.
      guessCounts: round?.guessCounts ?? {},
      selected,
      landedTile: drawn ? round?.landedTile ?? null : null,
      drawResultAt: drawResult?.at ?? null,
      cloudsActive: phase === "locked" || phase === "drawing",
      onPick: (i: number) => {
        audio.unlock();
        setSelected(i);
        pick(i);
      },
    };
  }, [round, selected, drawResult?.at, pick]);

  return <Scene view={view} />;
}
