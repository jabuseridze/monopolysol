/**
 * UI feedback cues -- the sounds the player triggers, rather than the ones the
 * draw sequence schedules.
 *
 * The draw's cue sheet lives in `drawCues.ts` and is re-exported here so that
 * `useGameAudio.ts` and `index.ts` keep addressing one `sfx` namespace.
 *
 * These three all take an optional time and default to "now": they fire in
 * response to a click or a tick, so there is no sheet to schedule against.
 */

import { burst, note, sfxCtx, tone } from "./synth";

export * from "./drawCues";
export * from "./celebration";

/**
 * Guess committed.
 *
 * A rising two-note pop rather than one blip. The confirmation the player
 * wants is "that went in", and a single tone reads as merely "noted" -- the
 * upward interval is what makes it feel accepted.
 */
export function guessPlaced(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  tone(c, { at: t, dur: 0.07, freq: note(7), type: "triangle", gain: 0.2, send: 0.15 });
  tone(c, { at: t + 0.065, dur: 0.16, freq: note(14), type: "triangle", gain: 0.22, send: 0.25 });
  // A touch of sparkle two octaves up, very quiet -- reads as "coin", not "beep".
  tone(c, { at: t + 0.065, dur: 0.1, freq: note(26), type: "sine", gain: 0.07, send: 0.3 });
}

/** Soft woodblock for the final seconds of the countdown. Deliberately not a
 * square-wave beep, which grated at one per second. */
export function tick(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  burst(c, { at: t, dur: 0.05, freq: 1800, q: 8, gain: 0.12, send: 0.12 });
}

/** Heads-up a few seconds before guessing closes. Falls in pitch, because a
 * rising cue reads as an invitation and this one is a warning. */
export function lockWarning(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  tone(c, { at: t, dur: 0.5, freq: note(-5), toFreq: note(-12), type: "triangle", gain: 0.16, attack: 0.06, send: 0.2 });
  tone(c, { at: t, dur: 0.55, freq: note(-17), toFreq: note(-24), type: "sine", gain: 0.12, attack: 0.06 });
}
