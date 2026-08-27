"use client";

import { useEffect, useState } from "react";
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
/** Orange while there is time, deepening as it drains, red at the wire. The
 * calm step used to be the board's pale green, which read as decoration against
 * the green field behind it -- orange is the one board colour nothing else on
 * screen competes with, so the ring is noticed without being alarming. */
const RING_CALM = "#f97216";
const RING_LOW = "#e2560b";
const RING_URGENT = "#e8483c";

/** Fast enough that the clock never visibly stalls, cheap enough to ignore --
 * it only re-renders one small DOM node. */
const CLOCK_TICK_MS = 250;

/**
 * Seconds remaining, counted down locally against the server's wall-clock
 * deadline.
 *
 * The server also sends its own `secondsLeft`, but that figure is measured on
 * the Solana cluster clock, which can run at a different *rate* from real time
 * -- markedly so on a local validator, whose `unix_timestamp` outpaces wall
 * time. Echoing it made the countdown skip a block of seconds at each of the
 * server's clock re-syncs and then freeze several seconds short of zero, with
 * the dice dropping while the clock still read 0:05. Counting down locally
 * against an absolute deadline is smooth; the server's periodic refresh of
 * that deadline nudges it, so it converges on the real lock instead of
 * lurching toward it.
 */
function useSecondsLeft(locksAtWall: number | undefined, active: boolean): number {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!active || !locksAtWall) {
      setSecs(0);
      return;
    }
    const tick = () => setSecs(Math.max(0, Math.ceil((locksAtWall - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [locksAtWall, active]);

  return secs;
}

export function Countdown() {
  const { round, connected } = useGame();
  const beat = useDrawBeat();
  const phase = round?.phase ?? "idle";
  const secs = useSecondsLeft(round?.locksAtWall, phase === "open");
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
      {/* The phase headline moves into the band: it is what this panel IS, not
          a caption above it. Plaque purple, because the countdown should be
          the thing you look at first. */}
      <div className="panel-band band-purple">{connected ? label : "Connecting to game..."}</div>

      <div className="clock-body">
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

      {/* Label above, figure below. Inline ("Prize pool 1.00 SOL") forced the
          whole thing to one small size to fit the column; stacking lets the
          number -- the part players actually read -- be large while the label
          shrinks out of the way. */}
      <div className="clock-meta">
        <div className="clock-prize-label">
          <span className="coin-dot" aria-hidden />
          Prize pool
        </div>
        <div className="clock-prize-value mono">{prize.toFixed(2)} SOL</div>
        {round ? <div className="clock-round">Round #{round.roundId}</div> : null}
      </div>
      </div>
    </div>
  );
}
