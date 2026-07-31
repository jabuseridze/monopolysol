"use client";

import { lamportsToSol, RoundPhase } from "@monopoly-sol/shared";
import { useGame } from "@/hooks/useGame";
import { useDrawBeat } from "@/hooks/useDrawBeat";

const PHASE_LABEL: Record<RoundPhase, string> = {
  idle: "Waiting for round",
  open: "Guess where the avatar lands",
  locked: "Guesses locked",
  drawing: "Rolling the dice",
  settled: "Round complete",
};

/** Headline per choreography beat. The phase alone can't drive this: the
 * on-chain settle+payout often confirms while the dice are still in the air,
 * flipping the phase to "settled" mid-roll -- which announced "Round
 * complete" over a live reveal. The beat clock follows what's on screen. */
const BEAT_LABEL: Record<string, string> = {
  anticipation: "Here we go...",
  roll: "Rolling the dice",
  settle: "Rolling the dice",
  sum: "The dice are in",
  walk: "And it's walking...",
  landing: "Landed!",
  celebration: "Landed!",
};

export function Countdown() {
  const { round, connected } = useGame();
  const beat = useDrawBeat();
  const phase = round?.phase ?? "idle";
  const secs = round?.secondsLeft ?? 0;
  const prize = round ? lamportsToSol(round.prizeLamports) : 0;
  const mm = String(Math.floor(secs / 60)).padStart(1, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const urgent = phase === "open" && secs <= 5;

  const inDraw = beat !== "idle" && beat !== "done";
  const label = inDraw ? BEAT_LABEL[beat] ?? PHASE_LABEL[phase] : PHASE_LABEL[phase];
  const readout = phase === "open" ? `${mm}:${ss}` : inDraw ? "ROLL!" : "--:--";

  return (
    <div
      className="panel"
      style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", padding: "12px 22px", textAlign: "center", minWidth: 260 }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
        {connected ? label : "Connecting to game..."}
      </div>
      <div className="mono" style={{ fontSize: 46, fontWeight: 800, color: urgent ? "#ff6b6b" : "var(--accent)", lineHeight: 1.05 }}>
        {readout}
      </div>
      <div style={{ fontSize: 14 }}>
        Prize pool <span className="mono" style={{ fontWeight: 700 }}>{prize.toFixed(2)} SOL</span>
        {round ? <span style={{ color: "var(--muted)" }}> - round #{round.roundId}</span> : null}
      </div>
    </div>
  );
}
