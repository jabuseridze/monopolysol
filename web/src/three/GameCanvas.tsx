"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DICE_TUMBLE_MS } from "@monopoly-sol/shared";
import { useGame } from "@/hooks/useGame";
import { useSubmitGuess } from "@/hooks/useSubmitGuess";
import { useSelection } from "@/hooks/useSelection";
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
    // Only trust `drawResult` once it actually matches the round it's paired
    // with -- a client that's had the socket open across a round boundary
    // could otherwise be left animating a stale walk from the prior round.
    const drawnForRound = round != null && drawResult != null && drawResult.roundId === round.roundId;

    return {
      phase,
      avatarTile: round?.avatarTile ?? 0,
      // The walk starts only once the dice tumble finishes -- dice roll,
      // then the avatar walks that many tiles -- not simultaneously.
      walk: drawnForRound
        ? {
            startTile: drawResult!.startTile,
            steps: drawResult!.diceA + drawResult!.diceB,
            at: drawResult!.at + DICE_TUMBLE_MS,
          }
        : null,
      dice: drawnForRound ? { a: drawResult!.diceA, b: drawResult!.diceB, at: drawResult!.at } : null,
      landedTile: drawn ? round?.landedTile ?? null : null,
      guessCounts: round?.guessCounts ?? {},
      selectedSum,
      winningSum: drawnForRound ? drawResult!.diceA + drawResult!.diceB : null,
      disabled: phase !== "open",
      cloudsActive: phase === "locked" || phase === "drawing",
      onGuess: (sum: number) => {
        audio.unlock();
        setSelectedSum(sum);
        submitGuess(sum);
      },
    };
  }, [round, selectedSum, drawResult, submitGuess]);

  // TEMP-SCREENSHOT-DEBUG: remove before commit.
  const debugView = buildDebugView(view);
  return <Scene view={debugView ?? view} />;
}

function buildDebugView(base: BoardView): BoardView | null {
  if (typeof window === "undefined") return null;
  const mode = new URLSearchParams(window.location.search).get("debug");
  if (!mode) return null;
  const now = Date.now();
  if (mode === "pads") {
    return {
      ...base,
      phase: "open",
      avatarTile: 5,
      guessCounts: { 5: 2, 7: 4, 9: 1, 12: 1 },
      selectedSum: 8,
      winningSum: null,
      disabled: false,
    };
  }
  if (mode === "dice") {
    return {
      ...base,
      phase: "drawing",
      avatarTile: 5,
      dice: { a: 3, b: 4, at: now - 600 },
      walk: null,
      landedTile: null,
      winningSum: 7,
    };
  }
  if (mode === "walk") {
    return {
      ...base,
      phase: "drawing",
      avatarTile: 12,
      dice: { a: 3, b: 4, at: now - 3000 },
      walk: { startTile: 5, steps: 7, at: now - 900 },
      landedTile: 12,
      winningSum: 7,
    };
  }
  return null;
}
