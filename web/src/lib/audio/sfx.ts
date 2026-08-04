/**
 * The named game cues. Each takes an absolute audio-clock time so the draw
 * sequence can schedule its whole cue sheet in one pass -- see `synth.ts` for
 * why that matters.
 */

import { burst, chord, note, panned, sfxCtx, tone, type Ctx } from "./synth";

/** Click when a guess is committed. */
export function guessPlaced(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  tone(c, { at: t, dur: 0.1, freq: note(7), toFreq: note(14), type: "triangle", gain: 0.22 });
}

/** Soft woodblock for the final seconds of the countdown. Deliberately not
 * the old square-wave beep, which grated at one per second. */
export function tick(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  burst(c, { at: t, dur: 0.05, freq: 1800, q: 8, gain: 0.12 });
}

/** Heads-up a few seconds before guessing closes. */
export function lockWarning(at?: number): void {
  const c = sfxCtx();
  if (!c) return;
  const t = at ?? c.ctx.currentTime;
  tone(c, { at: t, dur: 0.5, freq: note(-5), toFreq: note(-12), type: "triangle", gain: 0.16, attack: 0.06 });
}

/** Low bed under the anticipation beat, before the dice appear. */
export function drone(c: Ctx, at: number, dur: number): void {
  tone(c, { at, dur, freq: note(-24), toFreq: note(-19), type: "sawtooth", gain: 0.1, attack: dur * 0.6 });
  tone(c, { at, dur, freq: note(-36), type: "sine", gain: 0.14, attack: dur * 0.5 });
}

/**
 * One stick, built the way a real drum actually sounds: three layers, not one.
 *
 * The first attempt was a single dry noise crack, which read as a click track
 * rather than a drum. What was missing:
 *
 * - **A pitched body.** A struck membrane rings, and its pitch bends *down* as
 *   the head relaxes. That downward sweep is most of what makes a drum sound
 *   like a drum rather than static.
 * - **A separate transient.** The initial stick contact is a much shorter,
 *   brighter event than the body; fusing them into one envelope smears it.
 * - **A room.** Every voice sends to the reverb (`reverb.ts`); dry percussion
 *   always sounds synthetic.
 *
 * `tune` shifts the whole hit slightly per stroke so a roll doesn't machine-gun
 * one identical sample.
 */
function drumHit(c: Ctx, at: number, gain: number, tune: number): void {
  // Stick contact: very short, bright, barely any room.
  burst(c, { at, dur: 0.018, freq: 3400 * tune, q: 0.7, gain: gain * 0.55, send: 0.12 });
  // Body: the membrane ringing down. This is the layer that was missing.
  tone(c, {
    at,
    dur: 0.19,
    freq: 210 * tune,
    toFreq: 78 * tune,
    type: "triangle",
    gain: gain * 1.15,
    send: 0.3,
  });
  // Snare wires rattling under the head -- a noise tail, not a crack.
  burst(c, { at, dur: 0.1, freq: 1700 * tune, toFreq: 900, q: 0.9, gain: gain * 0.6, send: 0.35 });
}

/**
 * Drum roll under the dice, decelerating across the beat.
 *
 * The interval between sticks grows from `FAST` to `SLOW`, tracking the dice
 * visibly losing momentum on screen (`Dice.tsx` decays its spin quadratically
 * over the same window). Deliberately not a tonal riser -- a rising pad read
 * as *music* over the roll, which isn't what the moment wants.
 *
 * Written as a while-loop over elapsed time rather than a fixed hit count,
 * because the spacing is what's being controlled; the count falls out of it.
 * Strokes alternate across the stereo field like a real drummer's hands, and
 * each is detuned a little, so the roll has movement instead of repeating one
 * identical hit sixty times.
 */
export function drumRoll(c: Ctx, at: number, dur: number): void {
  const FAST = 0.036;
  const SLOW = 0.2;
  let t = 0;
  let hand = 0;
  while (t < dur) {
    const p = t / dur;
    const stroke = panned(c, hand % 2 === 0 ? -0.35 : 0.35);
    // Swells as it slows, so the last strokes land with weight. The leading
    // hand hits slightly harder, as it does in a real roll.
    const accent = hand % 2 === 0 ? 1 : 0.82;
    drumHit(stroke, at + t, (0.07 + 0.1 * p) * accent, 0.94 + Math.random() * 0.12);
    t += FAST + (SLOW - FAST) * Math.pow(p, 1.5);
    hand++;
  }
}

/** A die coming to rest. `heavy` is the second one -- bigger, since it's the
 * one that completes the sum. Sent hard to the room so the roll's ending
 * lands in the same space the drums were playing in. */
export function dieLock(c: Ctx, at: number, heavy: boolean): void {
  const g = heavy ? 0.42 : 0.3;
  burst(c, { at, dur: 0.09, freq: heavy ? 700 : 950, q: 3, gain: g, send: 0.4 });
  tone(c, {
    at,
    dur: heavy ? 0.3 : 0.22,
    freq: heavy ? 90 : 120,
    toFreq: 55,
    type: "sine",
    gain: g,
    send: 0.45,
  });
}

/** Bright stab when the sum is revealed. */
export function sumStab(c: Ctx, at: number): void {
  chord(c, [note(4), note(11), note(16)], { at, dur: 0.7, type: "triangle", gain: 0.3, attack: 0.006 });
}

export function footfall(c: Ctx, at: number): void {
  burst(c, { at, dur: 0.07, freq: 260, q: 1.6, gain: 0.14, type: "lowpass" });
}

export function landingBoom(c: Ctx, at: number): void {
  tone(c, { at, dur: 0.9, freq: 110, toFreq: 38, type: "sine", gain: 0.5 });
  burst(c, { at, dur: 0.5, freq: 1600, toFreq: 200, q: 0.8, gain: 0.28 });
}

/** Coins raining after the landing. */
export function coinSparkle(c: Ctx, at: number, count = 14): void {
  for (let i = 0; i < count; i++) {
    const t = at + Math.random() * 1.1;
    tone(c, {
      at: t,
      dur: 0.22,
      freq: note(19 + Math.floor(Math.random() * 3) * 4),
      type: "triangle",
      gain: 0.09,
    });
  }
}

export function fanfare(c: Ctx, at: number): void {
  const steps = [note(4), note(9), note(11), note(16)];
  steps.forEach((f, i) => tone(c, { at: at + i * 0.13, dur: 0.5, freq: f, type: "triangle", gain: 0.26 }));
  chord(c, [note(-8), note(4), note(11)], { at: at + steps.length * 0.13, dur: 1.4, type: "triangle", gain: 0.3 });
}

/**
 * The celebratory bed under the walk. Length is variable (the walk is
 * `steps × WALK_STEP_MS`), so this lays down a chord every `barSec` for as
 * long as it's given -- it can't be a fixed clip.
 */
export function celebrationBed(c: Ctx, at: number, dur: number, barSec: number): void {
  const progression = [
    [note(-8), note(-1), note(4)],
    [note(-3), note(1), note(8)],
    [note(-6), note(-1), note(6)],
    [note(-8), note(4), note(11)],
  ];
  const bars = Math.max(1, Math.ceil(dur / barSec));
  for (let i = 0; i < bars; i++) {
    const t = at + i * barSec;
    const remaining = Math.min(barSec, at + dur - t);
    if (remaining <= 0.05) break;
    chord(c, progression[i % progression.length], {
      at: t,
      dur: remaining * 0.95,
      type: "triangle",
      gain: 0.17,
      attack: 0.03,
    });
  }
}
