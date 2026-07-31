"use client";

import { useEffect, useState } from "react";
import { useGame } from "./useGame";
import { computeDrawBeat, type DrawBeat } from "@/three/DrawDirector";

/** Ticks fast enough that a beat change is imperceptible, but this drives
 * only a short HUD string -- it is not the animation clock. The 3D scene
 * reads `computeDrawBeat` directly inside its own `useFrame`. */
const POLL_MS = 100;

/**
 * The current draw-choreography beat, for DOM components.
 *
 * The HUD can't derive this from `round.phase`: the on-chain settle and
 * payout transactions often confirm while the dice are still tumbling, which
 * flips the phase to "settled" mid-reveal. Anything driven off phase alone
 * ends up announcing the round is over while it visibly isn't.
 */
export function useDrawBeat(): DrawBeat {
  const { round, drawResult } = useGame();
  const [beat, setBeat] = useState<DrawBeat>("idle");

  const forRound = round != null && drawResult != null && drawResult.roundId === round.roundId;
  const at = forRound ? drawResult!.at : null;
  const steps = forRound ? drawResult!.diceA + drawResult!.diceB : 0;

  useEffect(() => {
    if (at == null) {
      setBeat("idle");
      return;
    }
    const tick = () => setBeat(computeDrawBeat(Date.now(), at, steps).beat);
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [at, steps]);

  return beat;
}
