/**
 * A room for the drums to live in.
 *
 * Dry synthesised percussion is the single biggest tell that a sound is fake:
 * real drums are recorded in a space, and without one every hit sounds like it
 * happened inside the speaker. A ConvolverNode fed a generated impulse
 * response costs almost nothing and does most of the work of making the roll
 * read as cinematic rather than as a click track.
 *
 * The impulse is synthesised, not sourced -- exponentially decaying noise,
 * decorrelated per channel so the tail spreads across the stereo field.
 */

let convolver: ConvolverNode | null = null;
let wet: GainNode | null = null;
let builtFor: AudioContext | null = null;

function impulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Independent noise per channel -- a shared tail collapses to mono and
      // sounds like a delay rather than a room.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/**
 * The node to send signal into. Built once per context and wired to `dest`;
 * callers connect a send gain here in parallel with their dry path.
 */
export function reverbBus(ctx: AudioContext, dest: AudioNode): AudioNode {
  if (convolver && wet && builtFor === ctx) return convolver;

  convolver = ctx.createConvolver();
  convolver.buffer = impulseResponse(ctx, 1.8, 2.6);
  wet = ctx.createGain();
  wet.gain.value = 0.9;
  convolver.connect(wet).connect(dest);
  builtFor = ctx;
  return convolver;
}
