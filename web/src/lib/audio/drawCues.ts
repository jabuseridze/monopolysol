/**
 * The roll itself: anticipation, drum roll, the two dice landing, the sum.
 *
 * Everything after the dice settle -- the walk, the landing and the win --
 * lives in `celebration.ts`. UI feedback cues live in `sfx.ts`, which
 * re-exports both so callers address one `sfx` namespace.
 *
 * Every function takes an ABSOLUTE audio-clock time: the whole sheet is
 * scheduled in one pass so picture and sound cannot drift. See `synth.ts`.
 */

import { burst, chord, note, panned, tone, type Ctx } from "./synth";

/** Low bed under the anticipation beat, before the dice appear. */
export function drone(c: Ctx, at: number, dur: number): void {
  tone(c, { at, dur, freq: note(-24), toFreq: note(-19), type: "sawtooth", gain: 0.09, attack: dur * 0.6 });
  tone(c, { at, dur, freq: note(-36), type: "sine", gain: 0.14, attack: dur * 0.5 });
}

/**
 * One stick. Two layers carry it; a third only muddied things.
 *
 * The pitched body is what makes a drum read as a drum rather than as static:
 * a struck membrane rings, and its pitch bends *down* as the head relaxes. The
 * transient is a separate, much shorter event -- fusing the two into one
 * envelope smears the attack. An earlier version added a snare-wire noise tail
 * on every stroke, which at roll density turned into a continuous hiss, so the
 * wires now only appear on accents (see `drumRoll`).
 *
 * `tune` shifts each stroke slightly so a roll doesn't machine-gun one sample.
 */
function drumHit(c: Ctx, at: number, gain: number, tune: number, wires: boolean): void {
  burst(c, { at, dur: 0.014, freq: 3200 * tune, q: 0.8, gain: gain * 0.5, send: 0.1 });
  tone(c, {
    at,
    dur: 0.17,
    freq: 205 * tune,
    toFreq: 76 * tune,
    type: "triangle",
    gain: gain * 1.1,
    send: 0.28,
  });
  if (wires) {
    burst(c, { at, dur: 0.09, freq: 1600 * tune, toFreq: 900, q: 0.9, gain: gain * 0.4, send: 0.32 });
  }
}

/**
 * Drum roll under the dice, decelerating across the beat.
 *
 * Spacing grows from `FAST` to `SLOW`, tracking the dice visibly losing
 * momentum (`Dice.tsx` decays its spin over the same window). Written as a
 * while-loop over elapsed time because the *spacing* is what's controlled; the
 * hit count falls out of it.
 *
 * `FAST` used to be 36ms -- around 28 strokes a second, which stopped reading
 * as individual sticks and became a buzz. At 58ms the ear still resolves each
 * stroke, which is what makes the deceleration legible.
 */
export function drumRoll(c: Ctx, at: number, dur: number): void {
  const FAST = 0.058;
  const SLOW = 0.22;
  let t = 0;
  let hand = 0;
  while (t < dur) {
    const p = t / dur;
    const lead = hand % 2 === 0;
    const stroke = panned(c, lead ? -0.3 : 0.3);
    // Swells as it slows so the last strokes land with weight; the leading
    // hand hits harder, as it does in a real roll.
    drumHit(stroke, at + t, (0.07 + 0.1 * p) * (lead ? 1 : 0.8), 0.95 + Math.random() * 0.1, lead);
    t += FAST + (SLOW - FAST) * Math.pow(p, 1.5);
    hand++;
  }
}

/** A die coming to rest. `heavy` is the second one -- bigger, since it's the
 * one that completes the sum. */
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

/** The sum revealed: a sub drop under a bright bell stack. The sub is what
 * gives the reveal weight -- without it the chord alone reads as thin and the
 * moment passes without landing. */
export function sumStab(c: Ctx, at: number): void {
  tone(c, { at, dur: 0.5, freq: note(-24), toFreq: note(-36), type: "sine", gain: 0.34 });
  chord(c, [note(4), note(11), note(16)], { at, dur: 0.7, type: "triangle", gain: 0.28, attack: 0.005, send: 0.2 });
  chord(c, [note(28), note(35)], { at, dur: 0.35, type: "sine", gain: 0.1, attack: 0.003, send: 0.3 });
}

