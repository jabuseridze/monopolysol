/**
 * Everything after the dice settle: the walk, the landing, and the win.
 *
 * Split from `drawCues.ts` (which now covers only the roll itself) when the
 * celebration was rescored -- the two halves change for different reasons and
 * together they overran the file-size budget.
 *
 * Absolute audio-clock times throughout; see `synth.ts` for why.
 */

import { burst, chord, note, tone, type Ctx } from "./synth";

export function footfall(c: Ctx, at: number): void {
  burst(c, { at, dur: 0.07, freq: 260, q: 1.6, gain: 0.14, type: "lowpass" });
}

export function landingBoom(c: Ctx, at: number): void {
  tone(c, { at, dur: 0.9, freq: 110, toFreq: 38, type: "sine", gain: 0.5 });
  burst(c, { at, dur: 0.5, freq: 1600, toFreq: 200, q: 0.8, gain: 0.28, send: 0.35 });
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
      send: 0.25,
    });
  }
}

/** Win flourish: a fast rise that resolves onto a major chord and stops.
 * Deliberately short -- it fires on top of the celebration bed, and the older,
 * longer version fought the bed rather than capping it. */
export function fanfare(c: Ctx, at: number): void {
  const rise = [note(4), note(9), note(16)];
  rise.forEach((f, i) =>
    tone(c, { at: at + i * 0.1, dur: 0.34, freq: f, type: "triangle", gain: 0.24, send: 0.2 })
  );
  const land = at + rise.length * 0.1;
  chord(c, [note(-8), note(4), note(11), note(16)], {
    at: land,
    dur: 1.1,
    type: "triangle",
    gain: 0.3,
    send: 0.3,
  });
  tone(c, { at: land, dur: 0.6, freq: note(-32), type: "sine", gain: 0.3 });
}

/**
 * The celebratory bed under the walk. Its length is variable (the walk is
 * `steps × WALK_STEP_MS`), so it lays down a bar at a time for as long as it's
 * given -- it cannot be a fixed clip. `barSec` is four footfalls, so chord
 * changes land on the avatar's steps at any dice sum.
 */
export function celebrationBed(c: Ctx, at: number, dur: number, barSec: number): void {
  // A rising plagal-to-tonic march (IV - V - vi - I) rather than a wandering
  // loop: each bar of the walk should feel like it is climbing toward the
  // landing, and the cycle tops out on the tonic.
  const progression = [
    [note(-8), note(-1), note(4), note(8)],
    [note(-6), note(1), note(6), note(10)],
    [note(-3), note(4), note(9), note(13)],
    [note(-8), note(4), note(11), note(16)],
  ];
  const beat = barSec / 4;
  const bars = Math.max(1, Math.ceil(dur / barSec));

  for (let i = 0; i < bars; i++) {
    const t = at + i * barSec;
    const remaining = Math.min(barSec, at + dur - t);
    if (remaining <= 0.05) break;
    const voicing = progression[i % progression.length];

    // Brass-ish stabs on 1 and 3 instead of one sustained pad. A held chord
    // accompanies the walk; punched chords make it a procession.
    for (const off of [0, beat * 2]) {
      if (off >= remaining) break;
      chord(c, voicing, {
        at: t + off,
        dur: Math.min(beat * 1.7, remaining - off),
        type: "sawtooth",
        gain: 0.11,
        attack: 0.012,
        send: 0.3,
      });
      chord(c, voicing, {
        at: t + off,
        dur: Math.min(beat * 1.9, remaining - off),
        type: "triangle",
        gain: 0.14,
        attack: 0.02,
        send: 0.25,
      });
    }

    // Timpani-ish root on the downbeat, plus a pickup into the next bar --
    // the "pomp" is mostly this low pulse under the brass.
    tone(c, { at: t, dur: Math.min(beat * 1.6, remaining), freq: voicing[0] / 2, type: "sine", gain: 0.3, attack: 0.006 });
    if (remaining > beat * 3.5) {
      tone(c, { at: t + beat * 3.5, dur: beat * 0.5, freq: voicing[0] / 2, type: "sine", gain: 0.16, attack: 0.004 });
    }

    // Cymbal wash on the first bar and every other one after: marks the
    // procession's arrival points without hissing continuously.
    if (i % 2 === 0) {
      burst(c, { at: t, dur: 0.5, freq: 7000, toFreq: 3500, q: 0.5, gain: 0.05, send: 0.5 });
    }
  }
}
