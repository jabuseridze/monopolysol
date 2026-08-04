"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { useSubmitGuess } from "@/hooks/useSubmitGuess";
import { useSelection } from "@/hooks/useSelection";
import { useGameAudio } from "@/hooks/useGameAudio";
import { audio } from "@/lib/audio";
import { Scene } from "./Scene";
import { BoardView } from "./viewTypes";

export function GameCanvas() {
  const { round, drawCue, drawResult, settled } = useGame();
  const { publicKey } = useWallet();
  const roundId = round?.roundId ?? null;
  const { submitGuess } = useSubmitGuess(roundId);
  const { selected: selectedSum, setSelected: setSelectedSum } = useSelection();

  // Reset the local selection whenever a new round starts.
  useEffect(() => setSelectedSum(null), [roundId]);

  // The soundtrack: lobby bed between rounds, and the draw's cue sheet
  // scheduled against the same beat constants the animation uses.
  useGameAudio();

  // Audio cues driven by server events. The draw sequence has its own fanfare
  // for everyone; this is the extra flourish for the local winner only.
  useEffect(() => {
    if (drawCue) audio.alarm();
  }, [drawCue?.at]);
  useEffect(() => {
    if (settled && publicKey && settled.winners.includes(publicKey.toBase58())) {
      audio.win();
    }
  }, [settled?.at]);

  // Woodblock tick through the final seconds of the guessing window.
  const lastBlip = useRef(0);
  useEffect(() => {
    const s = round?.secondsLeft ?? 99;
    if (round?.phase === "open" && s <= 5 && s > 0 && s !== lastBlip.current) {
      lastBlip.current = s;
      audio.blip();
    }
  }, [round?.secondsLeft, round?.phase]);

  const view: BoardView = useMemo(() => {
    const phase = round?.phase ?? "idle";
    const drawn = phase === "drawing" || phase === "settled";
    // Only trust `drawResult` once it actually matches the round it's paired
    // with -- a client that's had the socket open across a round boundary
    // could otherwise be left animating a stale walk from the prior round.
    const drawnForRound = round != null && drawResult != null && drawResult.roundId === round.roundId;

    return {
      phase,
      avatarTile: round?.avatarTile ?? 0,
      // One master clock for the whole choreography: every beat offset lives
      // in shared/src/constants.ts and is measured from here, so the camera,
      // dice, avatar and effects can never drift apart.
      drawResultAt: drawnForRound ? drawResult!.at : null,
      walk: drawnForRound
        ? { startTile: drawResult!.startTile, steps: drawResult!.diceA + drawResult!.diceB }
        : null,
      dice: drawnForRound ? { a: drawResult!.diceA, b: drawResult!.diceB } : null,
      landedTile: drawn ? round?.landedTile ?? null : null,
      guessCounts: round?.guessCounts ?? {},
      selectedSum,
      winningSum: drawnForRound ? drawResult!.diceA + drawResult!.diceB : null,
      disabled: phase !== "open",
      youWon:
        settled != null &&
        round != null &&
        settled.roundId === round.roundId &&
        publicKey != null &&
        settled.winners.includes(publicKey.toBase58()),
      onGuess: (sum: number) => {
        audio.unlock();
        setSelectedSum(sum);
        submitGuess(sum);
      },
    };
  }, [round, selectedSum, drawResult, settled, publicKey, submitGuess]);

  return <Scene view={view} />;
}
