/**
 * The between-rounds bed, generated rather than streamed.
 *
 * This replaced a 3.4 MB `lobby.mp3`. Bundle size was the smaller reason: a
 * fixed clip has to either loop (audible seam) or restart from the top (what
 * the old code did), and neither sits well against a round whose length moves
 * with the dice. A generated loop just keeps going for as long as the round
 * lasts, and every restart lands somewhere slightly different.
 *
 * Scheduling uses the standard Web Audio two-clock pattern: a coarse
 * `setInterval` wakes a few times a second and hands the *audio* clock every
 * bar starting inside the next `SCHEDULE_AHEAD` seconds. The timer only
 * decides when to think -- it never decides when a note sounds, so its jitter
 * is inaudible.
 */

import { engine, fadeTo } from "./engine";
import { musicCtx, note, tone, burst, type Ctx } from "./synth";

// 82 BPM read as a waiting-room bed -- pleasant, and completely inert. A
// board game's between-turns music should feel like a game in progress, so
// this sits at a brisk-but-not-frantic walking tempo instead.
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

/** How far ahead bars are committed to the audio clock. Kept short so a
 * `stop()` isn't followed by notes already locked in beyond the fade. */
const SCHEDULE_AHEAD = 0.8;
const TICK_MS = 220;

/**
 * I - vi - IV - V: the four chords every board game, game show and toy advert
 * has ever used. The previous progression opened on a IV chord and never
 * resolved, which is what made it drift -- this one lands on the tonic at the
 * top of every cycle, so the loop has a downbeat you can feel.
 *
 * Voiced as triads with an added sixth or seventh rather than dense four-note
 * jazz stacks: brighter, and it leaves room for the walking bass underneath.
 */
const PROGRESSION: { voicing: number[]; bass: number }[] = [
  { voicing: [3, 7, 10, 14], bass: -21 }, // C6/9  (tonic -- the landing)
  { voicing: [0, 3, 7, 12], bass: -24 }, // Am7
  { voicing: [-4, 0, 5, 8], bass: -28 }, // Fmaj7
  { voicing: [-2, 2, 7, 11], bass: -26 }, // G7
];

/** Walking-bass offsets within a bar, as scale steps from the chord root.
 * Root - fifth - root - approach: the oldest trick for making a static chord
 * loop feel like it is going somewhere. */
const WALK = [0, 7, 12, 10];

let timer: ReturnType<typeof setInterval> | null = null;
let nextBarAt = 0;
let barIndex = 0;
let playing = false;

/**
 * One electric-piano-ish note: three sines, not one.
 *
 * A bare sine reads as a test tone. What sells a struck key is the *tine* --
 * a metallic partial an octave up that dies away far faster than the body --
 * plus a quiet twelfth that thickens the note without being heard as a
 * separate pitch.
 */
function key(c: Ctx, at: number, semi: number, gain: number, dur: number): void {
  const f = note(semi);
  tone(c, { at, dur, freq: f, type: "sine", gain, attack: 0.006, send: 0.25 });
  tone(c, {
    at,
    dur: Math.min(0.3, dur * 0.35),
    freq: f * 2,
    type: "sine",
    gain: gain * 0.32,
    attack: 0.003,
    send: 0.18,
  });
  tone(c, { at, dur: dur * 0.6, freq: f * 3, type: "sine", gain: gain * 0.07, attack: 0.005 });
}

/** Closed hat on the offbeat -- short, bright, quiet. This is what carries the
 * tempo; without it the chords alone float and the bed loses its pulse. */
function hat(c: Ctx, at: number, gain = 0.022): void {
  burst(c, { at, dur: 0.032, freq: 8200, q: 0.7, gain, send: 0.22 });
}

/** Backbeat. A rimshot rather than a full snare: it marks 2 and 4 without
 * turning the lobby into a drum track competing with the draw's own roll. */
function rim(c: Ctx, at: number): void {
  burst(c, { at, dur: 0.028, freq: 2400, q: 2.4, gain: 0.05, send: 0.35 });
  tone(c, { at, dur: 0.05, freq: 380, toFreq: 210, type: "triangle", gain: 0.045 });
}

/**
 * Renders one bar.
 *
 * Even passes play the chord as a block; odd passes arpeggiate it. That single
 * alternation is most of what stops a four-chord loop feeling like a four-chord
 * loop -- the harmony repeats every 4 bars but the texture only every 8.
 */
function bar(c: Ctx, at: number, index: number): void {
  const { voicing, bass } = PROGRESSION[index % PROGRESSION.length];
  const arpeggiate = Math.floor(index / PROGRESSION.length) % 2 === 1;

  // Walking bass: one note per beat, plucky rather than sustained, so the
  // movement is audible as movement. A single held root per bar (the previous
  // version) is what made the bed feel static no matter the tempo.
  WALK.forEach((step, i) => {
    tone(c, {
      at: at + i * BEAT,
      dur: BEAT * 0.82,
      freq: note(bass + step),
      type: "triangle",
      gain: 0.13,
      attack: 0.008,
    });
  });

  if (arpeggiate) {
    // Eighth-note arpeggio, up then back down -- keeps the hand moving across
    // the whole bar instead of stopping halfway.
    const run = [...voicing, ...voicing.slice(0, -1).reverse()];
    run.forEach((semi, i) => key(c, at + i * BEAT * 0.5, semi, 0.055, BEAT * 1.1));
  } else {
    // Comped on the offbeats rather than one block chord on the downbeat: the
    // syncopation is most of what separates "playful" from "waiting room".
    for (const semi of voicing) {
      key(c, at + BEAT * 0.5, semi, 0.05, BEAT * 1.1);
      key(c, at + BEAT * 2.5, semi, 0.042, BEAT * 1.1);
    }
    key(c, at, voicing[0], 0.05, BEAT * 0.9);
  }

  // Eighth-note hats with the offbeats lighter, so the bar swings a little.
  for (let i = 0; i < 8; i++) hat(c, at + i * BEAT * 0.5, i % 2 === 0 ? 0.024 : 0.014);
  rim(c, at + BEAT);
  rim(c, at + BEAT * 3);
}

/** Commits any bar that begins inside the lookahead window. */
function pump(): void {
  const c = musicCtx();
  if (!c || !playing) return;
  while (nextBarAt < c.ctx.currentTime + SCHEDULE_AHEAD) {
    // A tab left in the background can suspend the clock; when it resumes,
    // catch up to the present rather than dumping every missed bar at once.
    if (nextBarAt < c.ctx.currentTime) nextBarAt = c.ctx.currentTime + 0.05;
    bar(c, nextBarAt, barIndex);
    nextBarAt += BAR;
    barIndex++;
  }
}

/** Start the bed from the top of the progression, replacing anything playing. */
export async function playFromStart(fadeInSec = 0.4): Promise<void> {
  const c = musicCtx();
  if (!c || !engine.music) return;

  stopScheduler();
  barIndex = 0;
  nextBarAt = c.ctx.currentTime + 0.06;
  playing = true;

  engine.music.gain.cancelScheduledValues(c.ctx.currentTime);
  engine.music.gain.setValueAtTime(0.0001, c.ctx.currentTime);
  fadeTo(engine.music.gain, 1, c.ctx.currentTime, fadeInSec);

  pump();
  timer = setInterval(pump, TICK_MS);
}

function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
  playing = false;
}

/** Fade out and stop scheduling. Used when the draw takes over the soundtrack. */
export function stop(fadeOutSec = 0.4): void {
  const ctx = engine.ensure();
  stopScheduler();
  if (!ctx || !engine.music) return;
  fadeTo(engine.music.gain, 0.0001, ctx.currentTime, fadeOutSec);
}

/** Kept for API compatibility with the old streamed bed -- there is nothing
 * left to fetch, so this only warms the context. */
export function preload(): void {
  engine.ensure();
}

export function isPlaying(): boolean {
  return playing;
}
