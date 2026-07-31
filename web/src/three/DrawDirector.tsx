"use client";

import {
  BEAT_LANDING_MS,
  BEAT_ROLL_AT_MS,
  BEAT_SETTLE_AT_MS,
  BEAT_SUM_AT_MS,
  BEAT_WALK_AT_MS,
  BEAT_CELEBRATION_MS,
  drawSequenceDurationMs,
  walkDurationMs,
} from "@monopoly-sol/shared";

export type DrawBeat =
  | "idle"
  | "anticipation"
  | "roll"
  | "settle"
  | "sum"
  | "walk"
  | "landing"
  | "celebration"
  | "done";

export interface DrawBeatState {
  beat: DrawBeat;
  /** Ms elapsed within the current beat (0 at the beat's start). */
  tBeat: number;
  /** Ms elapsed since `drawResult.at` -- the whole sequence's clock. */
  tTotal: number;
}

/** Re-exported so the rest of `web/src/three/` has one import site for both
 * the beat clock and the duration helpers it's built from. */
export { drawSequenceDurationMs, walkDurationMs };

/**
 * Pure beat clock: converts `now - drawResultAt` into which beat is active
 * and how far into it, off the shared boundary constants in
 * `shared/src/constants.ts`. This is the single source every choreography
 * component (`CinematicCamera`, `Dice`, `Avatar`, `Hologram`, and the
 * `Shockwave`/`TileRipple`/`CoinBurst`/`SumFlare` call sites in `Scene.tsx`)
 * reads from inside its own `useFrame` -- nothing recomputes its own beat
 * offsets. Not a mounted component: R3F components already poll
 * `Date.now()` per-frame themselves (see `Hologram.tsx`), so this stays a
 * plain function rather than adding a context/provider layer.
 */
export function computeDrawBeat(now: number, drawResultAt: number | null, walkSteps: number): DrawBeatState {
  if (drawResultAt == null) return { beat: "idle", tBeat: 0, tTotal: 0 };

  const t = now - drawResultAt;
  const walkMs = walkDurationMs(walkSteps);
  const landingAt = BEAT_WALK_AT_MS + walkMs;
  const celebrationAt = landingAt + BEAT_LANDING_MS;
  const doneAt = celebrationAt + BEAT_CELEBRATION_MS;

  if (t < BEAT_ROLL_AT_MS) return { beat: "anticipation", tBeat: t, tTotal: t };
  if (t < BEAT_SETTLE_AT_MS) return { beat: "roll", tBeat: t - BEAT_ROLL_AT_MS, tTotal: t };
  if (t < BEAT_SUM_AT_MS) return { beat: "settle", tBeat: t - BEAT_SETTLE_AT_MS, tTotal: t };
  if (t < BEAT_WALK_AT_MS) return { beat: "sum", tBeat: t - BEAT_SUM_AT_MS, tTotal: t };
  if (t < landingAt) return { beat: "walk", tBeat: t - BEAT_WALK_AT_MS, tTotal: t };
  if (t < celebrationAt) return { beat: "landing", tBeat: t - landingAt, tTotal: t };
  if (t < doneAt) return { beat: "celebration", tBeat: t - celebrationAt, tTotal: t };
  return { beat: "done", tBeat: t - doneAt, tTotal: t };
}
