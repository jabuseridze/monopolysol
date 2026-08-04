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

const RADIUS = 58;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Colour steps for the draining ring, all sampled from the board art: the
 * centre field's green while there's time, the running track's salmon as it
 * runs down, the GO arrow's red at the wire. */
const RING_CALM = "#c8e780";
const RING_LOW = "#da9c77";
const RING_URGENT = "#e8483c";

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

  // The ring only means anything while guessing is open. Through the draw it
  // holds full rather than snapping to empty, so it reads as "time's up, watch
  // this" instead of as a second thing counting down alongside the dice.
  const duration = round?.durationSec ?? 0;
  const fraction = phase === "open" && duration > 0 ? Math.min(1, Math.max(0, secs / duration)) : 1;
  const ringColor = urgent ? RING_URGENT : fraction <= 0.2 ? RING_LOW : RING_CALM;

  return (
    <div className="panel clock">
      <div className="clock-eyebrow">{connected ? label : "Connecting to game..."}</div>

      <div className="clock-ring">
        <svg viewBox="0 0 132 132" aria-hidden>
          <circle className="clock-ring-track" cx="66" cy="66" r={RADIUS} fill="none" strokeWidth={STROKE} />
          <circle
            className="clock-ring-fill"
            cx="66"
            cy="66"
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
        <div
          className={`clock-readout mono${urgent ? " urgent" : ""}${inDraw ? " roll" : ""}`}
          role="timer"
          aria-live="off"
        >
          {phase === "open" ? `${mm}:${ss}` : inDraw ? "ROLL!" : "--:--"}
        </div>
      </div>

      <div className="clock-prize">
        <span className="coin-dot" aria-hidden />
        <span>
          Prize pool <strong className="mono">{prize.toFixed(2)} SOL</strong>
        </span>
        {round ? <span className="clock-round">round #{round.roundId}</span> : null}
      </div>
    </div>
  );
}
