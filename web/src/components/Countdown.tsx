"use client";

import { lamportsToSol, RoundPhase } from "@monopoly-sol/shared";
import { useGame } from "@/hooks/useGame";

const PHASE_LABEL: Record<RoundPhase, string> = {
  idle: "Waiting for round",
  open: "Pick a property",
  locked: "Picks locked",
  drawing: "Drawing winner",
  settled: "Round complete",
};

export function Countdown() {
  const { round, connected } = useGame();
  const phase = round?.phase ?? "idle";
  const secs = round?.secondsLeft ?? 0;
  const prize = round ? lamportsToSol(round.prizeLamports) : 0;
  const mm = String(Math.floor(secs / 60)).padStart(1, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const urgent = phase === "open" && secs <= 5;

  return (
    <div
      className="panel"
      style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", padding: "12px 22px", textAlign: "center", minWidth: 260 }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
        {connected ? PHASE_LABEL[phase] : "Connecting to game..."}
      </div>
      <div className="mono" style={{ fontSize: 46, fontWeight: 800, color: urgent ? "#ff6b6b" : "var(--accent)", lineHeight: 1.05 }}>
        {phase === "open" ? `${mm}:${ss}` : phase === "drawing" ? "SPIN!" : "--:--"}
      </div>
      <div style={{ fontSize: 14 }}>
        Prize pool <span className="mono" style={{ fontWeight: 700 }}>{prize.toFixed(2)} SOL</span>
        {round ? <span style={{ color: "var(--muted)" }}> - round #{round.roundId}</span> : null}
      </div>
    </div>
  );
}
