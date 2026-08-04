/**
 * AudioContext lifecycle and the bus graph everything else routes through.
 *
 * Two sub-buses, not one: the draw sequence has to silence the music while
 * leaving its own effects at full level, and a single master gain can't
 * express that. The compressor on the master catches the moments where the
 * fanfare, the coin burst and the landing boom all land within ~200ms of each
 * other, which clips badly without it.
 */

const MUTE_KEY = "chain-estates:muted";

function readStoredMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Private-mode Safari throws on localStorage access rather than returning
    // null; a missing preference is not worth breaking audio over.
    return false;
  }
}

class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;

  /** Default ON. Browsers refuse to start audio until the page has been
   * interacted with, so a freshly opened tab is silent regardless -- nothing
   * can play unprompted. A stored preference always wins. */
  muted = readStoredMute();

  /** Builds the graph on first use. Returns null during SSR. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    const music = ctx.createGain();
    const sfx = ctx.createGain();

    master.gain.value = this.muted ? 0 : 1;
    music.gain.value = 1;
    sfx.gain.value = 1;

    music.connect(master);
    sfx.connect(master);
    master.connect(comp).connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.music = music;
    this.sfx = sfx;
    return ctx;
  }

  /** Call from a user gesture -- browsers start every context suspended. */
  unlock(): void {
    void this.ensure()?.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* see readStoredMute */
    }
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    // Ramp rather than snap: a step change on a gain node is a click.
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    if (!m) void ctx.resume();
  }

  /** Current audio-clock time in seconds, or null if audio isn't available. */
  now(): number | null {
    const ctx = this.ensure();
    return ctx ? ctx.currentTime : null;
  }
}

export const engine = new Engine();

/** Linear-ish fade helper shared by the music layer and the mute toggle. */
export function fadeTo(param: AudioParam, value: number, at: number, seconds: number): void {
  param.cancelScheduledValues(at);
  param.setValueAtTime(param.value, at);
  param.linearRampToValueAtTime(value, at + seconds);
}
