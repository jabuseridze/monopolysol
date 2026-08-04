/**
 * Synthesis primitives. Nothing here knows anything about the game -- see
 * `sfx.ts` for the named cues built on top.
 *
 * Every function takes an ABSOLUTE start time on the audio clock (seconds,
 * i.e. `AudioContext.currentTime` units) rather than "now". The draw sequence
 * schedules its entire cue sheet up front, and `setTimeout` jitters by tens of
 * milliseconds -- enough to visibly separate a dice clatter from the die
 * landing on screen.
 */

import { engine } from "./engine";
import { reverbBus } from "./reverb";

let noiseBuf: AudioBuffer | null = null;

/** Two seconds of white noise, built once and re-used by every burst. Cheap
 * to allocate but not per-hit: the dice rattle alone fires dozens of times. */
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

export interface Ctx {
  ctx: AudioContext;
  out: AudioNode;
  /** Reverb send. Voices connect here in parallel with `out`. */
  verb: AudioNode;
}

/** Resolves the shared context + the SFX bus, or null when audio is
 * unavailable (SSR) or muted. Callers early-return on null. */
export function sfxCtx(): Ctx | null {
  const ctx = engine.ensure();
  if (!ctx || engine.muted || !engine.sfx) return null;
  return { ctx, out: engine.sfx, verb: reverbBus(ctx, engine.sfx) };
}

/** Same graph, but routed through a panner -- lets one cue place its voices
 * across the stereo field without every primitive growing a `pan` option. */
export function panned(c: Ctx, pan: number): Ctx {
  const p = c.ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(c.out);
  return { ctx: c.ctx, out: p, verb: c.verb };
}

/** Wires a voice's output to the dry bus, and optionally to the room. */
function route(c: Ctx, g: GainNode, send?: number): void {
  g.connect(c.out);
  if (!send) return;
  const s = c.ctx.createGain();
  s.gain.value = send;
  g.connect(s).connect(c.verb);
}

interface BurstOpts {
  at: number;
  dur: number;
  /** Band-pass centre. Dice and impacts live around 400-3000Hz. */
  freq: number;
  q?: number;
  gain?: number;
  /** Optional end frequency -- sweeps the filter across the burst. */
  toFreq?: number;
  type?: BiquadFilterType;
  /** 0-1 amount sent to the room. */
  send?: number;
}

/** Filtered noise burst: the workhorse for dice, impacts and footsteps.
 * The old oscillator-only synth could not produce any of these. */
export function burst(c: Ctx, o: BurstOpts): void {
  const { ctx, out } = c;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  // Random offset so repeated hits don't phase-align into an obvious loop.
  const offset = Math.random() * 1.5;

  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.frequency.setValueAtTime(o.freq, o.at);
  if (o.toFreq != null) filter.frequency.exponentialRampToValueAtTime(o.toFreq, o.at + o.dur);
  filter.Q.value = o.q ?? 1;

  const g = ctx.createGain();
  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(peak, o.at + Math.min(0.008, o.dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

  src.connect(filter).connect(g);
  route(c, g, o.send);
  src.start(o.at, offset, o.dur + 0.05);
  src.stop(o.at + o.dur + 0.05);
}

interface ToneOpts {
  at: number;
  dur: number;
  freq: number;
  toFreq?: number;
  type?: OscillatorType;
  gain?: number;
  /** Attack in seconds. Longer values give pads/drones their swell. */
  attack?: number;
  /** 0-1 amount sent to the room. */
  send?: number;
}

/** Pitched voice with a real envelope, optionally gliding in pitch. */
export function tone(c: Ctx, o: ToneOpts): void {
  const { ctx, out } = c;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.at);
  if (o.toFreq != null) osc.frequency.exponentialRampToValueAtTime(o.toFreq, o.at + o.dur);

  const g = ctx.createGain();
  const peak = o.gain ?? 0.2;
  const attack = Math.min(o.attack ?? 0.01, o.dur * 0.8);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(peak, o.at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

  osc.connect(g);
  route(c, g, o.send);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.02);
}

/** A chord, as simultaneous tones. Used for the celebratory bed and fanfare. */
export function chord(c: Ctx, freqs: number[], o: Omit<ToneOpts, "freq">): void {
  for (const f of freqs) tone(c, { ...o, freq: f, gain: (o.gain ?? 0.2) / freqs.length });
}

/** Equal-temperament helper so chords read as note offsets, not magic Hz. */
export function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}
