/**
 * Subtle idle motion for board tiles. Each tile gently bobs with a per-index
 * phase offset, and occasionally a pseudo-random tile "pops" up a bit further,
 * so the board feels alive without any tile drifting out of place.
 */

const BOB_AMPLITUDE = 0.035;
const BOB_SPEED = 1.1;
const POP_PERIOD = 2.6; // seconds between pop windows
const POP_DURATION = 0.9; // how long a pop lasts
const POP_HEIGHT = 0.28;

/** Vertical offset (world units) for a tile at time `t` seconds. */
export function tileIdleY(index: number, t: number): number {
  const phase = index * 0.6;
  const bob = Math.sin(t * BOB_SPEED + phase) * BOB_AMPLITUDE;

  // Deterministic "which tile pops now" based on the current pop window.
  const windowId = Math.floor(t / POP_PERIOD);
  const popTile = hash(windowId) % 40;
  let pop = 0;
  if (index === popTile) {
    const local = t - windowId * POP_PERIOD;
    if (local < POP_DURATION) {
      pop = Math.sin((local / POP_DURATION) * Math.PI) * POP_HEIGHT;
    }
  }
  return bob + pop;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return Math.floor(Math.abs(x - Math.floor(x)) * 1000);
}
