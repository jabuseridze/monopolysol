/**
 * Tiny Web Audio synth for SFX so we ship zero binary audio assets.
 * All sounds are generated from oscillators; call unlock() on first user
 * gesture (browsers block audio until then).
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  /**
   * All SFX are muted by default for now. Every sound routes through tone(),
   * which early-returns while this is true, so this single flag is the global
   * off switch. Flip to `false` (or hit the in-app mute toggle) to re-enable.
   */
  muted = true;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }

  unlock() {
    this.ensure()?.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  pick() {
    this.tone(660, 0.12, "triangle", 0.25);
  }

  /** Countdown blip in the final seconds. */
  blip() {
    this.tone(880, 0.09, "square", 0.15);
  }

  /** Alarm just before the draw. */
  alarm() {
    this.tone(440, 0.18, "sawtooth", 0.2);
    setTimeout(() => this.tone(587, 0.18, "sawtooth", 0.2), 180);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.22, "triangle", 0.25), i * 130)
    );
  }
}

export const audio = new AudioManager();
