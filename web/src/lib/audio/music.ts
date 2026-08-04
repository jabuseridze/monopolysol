/**
 * The between-rounds music bed.
 *
 * No looping logic on purpose: the track is longer than the guessing window,
 * and the design is that it restarts from the top each round rather than
 * resuming mid-phrase. So it's play-from-zero, stop, play-from-zero again.
 *
 * The file is optional. A missing or undecodable track degrades to silence --
 * the synthesised cues carry the game on their own, and a 404 here must never
 * take the page down.
 */

import { engine, fadeTo } from "./engine";

const LOBBY_URL = "/audio/lobby.mp3";

let buffer: AudioBuffer | null = null;
let loading: Promise<AudioBuffer | null> | null = null;
let source: AudioBufferSourceNode | null = null;

async function load(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(LOBBY_URL);
      if (!res.ok) return null;
      buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      return buffer;
    } catch {
      return null;
    }
  })();
  return loading;
}

function stopSource(): void {
  if (!source) return;
  try {
    source.stop();
  } catch {
    // Already stopped -- stop() throws if called twice on one node.
  }
  source.disconnect();
  source = null;
}

/** Start the bed from the beginning, replacing anything already playing. */
export async function playFromStart(fadeInSec = 0.4): Promise<void> {
  const ctx = engine.ensure();
  if (!ctx || !engine.music) return;
  const buf = await load(ctx);
  if (!buf) return;

  stopSource();
  engine.music.gain.cancelScheduledValues(ctx.currentTime);
  engine.music.gain.setValueAtTime(0.0001, ctx.currentTime);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(engine.music);
  src.start();
  source = src;

  fadeTo(engine.music.gain, 1, ctx.currentTime, fadeInSec);
}

/** Fade out and stop. Used when the draw takes over the soundtrack. */
export function stop(fadeOutSec = 0.4): void {
  const ctx = engine.ensure();
  if (!ctx || !engine.music) return;
  const stopAt = ctx.currentTime + fadeOutSec;
  fadeTo(engine.music.gain, 0.0001, ctx.currentTime, fadeOutSec);
  const ending = source;
  if (!ending) return;
  try {
    ending.stop(stopAt + 0.05);
  } catch {
    /* already stopped */
  }
  if (source === ending) source = null;
}

/** Warm the decode before it's first needed, so the restart after a round
 * isn't delayed by a 3.4 MB fetch. Safe to call repeatedly. */
export function preload(): void {
  const ctx = engine.ensure();
  if (ctx) void load(ctx);
}

export function isPlaying(): boolean {
  return source !== null;
}
