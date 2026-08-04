/**
 * Public audio surface.
 *
 * Keeps the method names the rest of the app already calls (`pick`, `blip`,
 * `alarm`, `win`, `unlock`, `setMuted`, `muted`) so `useSubmitGuess.ts`,
 * `GameCanvas.tsx` and `MuteButton.tsx` didn't have to change when the
 * one-file oscillator synth became `lib/audio/`.
 */

import { engine } from "./engine";
import * as music from "./music";
import * as sfx from "./sfx";
import { sfxCtx } from "./synth";

export const audio = {
  get muted(): boolean {
    return engine.muted;
  },

  unlock(): void {
    engine.unlock();
    music.preload();
  },

  setMuted(m: boolean): void {
    engine.setMuted(m);
  },

  /** Guess committed. */
  pick(): void {
    sfx.guessPlaced();
  },

  /** Countdown tick in the final seconds. */
  blip(): void {
    sfx.tick();
  },

  /** Guessing is about to close. */
  alarm(): void {
    sfx.lockWarning();
  },

  /** Standalone win flourish, for the local winner on top of the draw
   * sequence's own celebration. */
  win(): void {
    const c = sfxCtx();
    if (!c) return;
    sfx.fanfare(c, c.ctx.currentTime);
  },

  music,
};

export { engine, music, sfx };
