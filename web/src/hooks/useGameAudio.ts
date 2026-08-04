"use client";

import { useEffect, useRef } from "react";
import {
  BEAT_ANTICIPATION_MS,
  BEAT_CELEBRATION_MS,
  BEAT_LANDING_MS,
  BEAT_ROLL_AT_MS,
  BEAT_SETTLE_AT_MS,
  BEAT_SUM_AT_MS,
  BEAT_WALK_AT_MS,
  DIE_A_LOCK_MS,
  DIE_B_LOCK_MS,
  WALK_STEP_MS,
  drawSequenceDurationMs,
  walkDurationMs,
} from "@monopoly-sol/shared";
import { engine, music, sfx } from "@/lib/audio";
import { sfxCtx } from "@/lib/audio/synth";
import { useGame } from "./useGame";

/** How long after the winner is announced the lobby bed restarts. */
const MUSIC_RESTART_DELAY_MS = 1000;
/** Four footfalls to the bar, so the celebratory bed's chord changes land on
 * the avatar's steps at any dice sum. */
const CELEBRATION_BAR_SEC = (WALK_STEP_MS * 4) / 1000;

/**
 * Drives the whole soundtrack.
 *
 * The draw's cue sheet is scheduled **in one pass on the audio clock** the
 * moment the result arrives, rather than fired from timers as each beat comes
 * round. `setTimeout` jitters by tens of milliseconds, which is enough to
 * visibly separate a dice clatter from the die hitting the board; scheduling
 * against `AudioContext.currentTime` is sample-accurate. Every offset below is
 * one of the shared beat constants the animation uses, so picture and sound
 * cannot drift apart.
 */
export function useGameAudio(): void {
  const { round, drawResult } = useGame();
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledFor = useRef<number | null>(null);

  const phase = round?.phase ?? "idle";
  const forRound = round != null && drawResult != null && drawResult.roundId === round.roundId;
  const at = forRound ? drawResult!.at : null;
  const steps = forRound ? drawResult!.diceA + drawResult!.diceB : 0;

  // --- The draw ----------------------------------------------------------
  useEffect(() => {
    if (at == null || scheduledFor.current === at) return;

    const ctx = engine.ensure();
    const c = sfxCtx();
    // A suspended context (the visitor hasn't interacted yet) would bank every
    // scheduled cue and fire them together on resume. Skip the round instead.
    if (!ctx || !c || ctx.state !== "running") return;
    scheduledFor.current = at;

    const walkMs = walkDurationMs(steps);
    const landingMs = BEAT_WALK_AT_MS + walkMs;
    const celebrateMs = landingMs + BEAT_LANDING_MS;
    // Elapsed offset for a client that joined mid-draw: cues already in the
    // past are skipped rather than crammed into the present.
    const base = ctx.currentTime + (at - Date.now()) / 1000;
    const cue = (ms: number, fn: (t: number) => void) => {
      const t = base + ms / 1000;
      if (t >= ctx.currentTime) fn(t);
    };

    music.stop(0.4);

    cue(0, (t) => sfx.drone(c, t, BEAT_ANTICIPATION_MS / 1000));

    // The build runs from the drop right up to the first die landing, then
    // stops dead -- the gap before the second die is the tension beat and has
    // to be genuinely silent, not merely quieter.
    const buildMs = BEAT_SETTLE_AT_MS + DIE_A_LOCK_MS - BEAT_ROLL_AT_MS;
    cue(BEAT_ROLL_AT_MS, (t) => sfx.riser(c, t, buildMs / 1000));
    cue(BEAT_ROLL_AT_MS, (t) => sfx.rattle(c, t, buildMs / 1000));

    cue(BEAT_SETTLE_AT_MS + DIE_A_LOCK_MS, (t) => sfx.dieLock(c, t, false));
    cue(BEAT_SETTLE_AT_MS + DIE_B_LOCK_MS, (t) => sfx.dieLock(c, t, true));
    cue(BEAT_SUM_AT_MS, (t) => sfx.sumStab(c, t));

    // Celebratory bed starts with the walk, not at the landing: the user asked
    // for it to play "while the character approaches the winner tile".
    const bedMs = walkMs + BEAT_LANDING_MS + BEAT_CELEBRATION_MS;
    cue(BEAT_WALK_AT_MS, (t) => sfx.celebrationBed(c, t, bedMs / 1000, CELEBRATION_BAR_SEC));
    for (let n = 0; n < steps; n++) {
      cue(BEAT_WALK_AT_MS + n * WALK_STEP_MS, (t) => sfx.footfall(c, t));
    }

    cue(landingMs, (t) => sfx.landingBoom(c, t));
    cue(celebrateMs, (t) => sfx.fanfare(c, t));
    cue(celebrateMs, (t) => sfx.coinSparkle(c, t));

    // The bed restart is a fetch/decode, not an audio-graph event, so it can't
    // be pre-scheduled on the audio clock like the cues above.
    if (restartTimer.current) clearTimeout(restartTimer.current);
    const restartIn = at + drawSequenceDurationMs(steps) + MUSIC_RESTART_DELAY_MS - Date.now();
    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      void music.playFromStart();
    }, Math.max(0, restartIn));
  }, [at, steps]);

  // --- The lobby bed between rounds --------------------------------------
  // Covers first load and a page opened mid-round. After a draw the restart is
  // owned by the timer above, so this stands down while one is pending --
  // otherwise it would jump the gun on the requested one-second pause.
  useEffect(() => {
    if (phase !== "open" || restartTimer.current || music.isPlaying()) return;
    const ctx = engine.ensure();
    if (!ctx || ctx.state !== "running") return;
    void music.playFromStart();
  }, [phase, at]);

  // --- First gesture ------------------------------------------------------
  // Browsers start every AudioContext suspended and refuse to resume it
  // outside a user gesture, so audio is unreachable until the visitor touches
  // the page. This is also what makes defaulting to unmuted safe: a freshly
  // opened tab cannot make a sound until it is clicked.
  useEffect(() => {
    const start = () => {
      engine.unlock();
      if (!engine.muted && !music.isPlaying()) void music.playFromStart();
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  useEffect(() => () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
  }, []);
}
