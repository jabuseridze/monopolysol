/**
 * Player-facing prose for the tile effects. Split out of `effects.ts` so that
 * file stays purely the math the on-chain program mirrors: nothing here is
 * consulted when computing a prize, and nothing in `effects.ts` needs to know
 * how a rule is worded.
 *
 * This module is the single source for every rule string in the UI -- the
 * board tooltip (`web/src/three/Tile.tsx`), the rules panel
 * (`web/src/components/RulesPanel.tsx`) and the guess-pad badges. Do not
 * hardcode rule text anywhere else; the numbers below are derived from the
 * same constants the Rust `effects.rs` mirrors.
 */

import { lamportsToSol } from "./constants";
import {
  GO_BONUS_LAMPORTS,
  GO_TILE,
  PENALTY_PRIZE_LAMPORTS,
  PENALTY_TILES,
  PUMP_PRIZE_LAMPORTS,
  PUMP_TILES,
  RUG_PRIZE_LAMPORTS,
  RUG_TILE,
} from "./effects";
import { getTile, NUM_TILES } from "./tiles";

/** Trims a lamport amount to a compact SOL string with no trailing zeros
 * beyond one decimal place (0.5, 0.25, 1.0, 0.1 -- never "1.00" or "0.30"). */
function fmtSol(lamports: number): string {
  const s = lamportsToSol(lamports).toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

/** Whether an effect raises or lowers the next round's prize. Drives the
 * grouping in the rules panel and the badge colour on the guess pads. */
export type EffectTone = "boost" | "penalty";

export interface TileEffect {
  /** Short name for the effect, shown as the tooltip's headline. */
  label: string;
  /** Full sentence describing what landing here does to the next prize. */
  detail: string;
  /** Direction of the effect on the next prize. */
  tone: EffectTone;
}

/**
 * Human-readable summary of a tile's effect on the *next* round's prize.
 * Returns null for plain tiles with no special effect.
 */
export function effectForTile(index: number): TileEffect | null {
  if (index === GO_TILE) {
    return {
      label: "GO",
      detail: `Passing or landing on GO adds +${fmtSol(GO_BONUS_LAMPORTS)} SOL to the next prize`,
      tone: "boost",
    };
  }
  if (PENALTY_TILES.has(index)) {
    const name = getTile(index)?.name ?? "Tax";
    return { label: name, detail: `Next prize drops to ${fmtSol(PENALTY_PRIZE_LAMPORTS)} SOL`, tone: "penalty" };
  }
  if (index === RUG_TILE) {
    return { label: "Get Rugged", detail: `Next prize drops to ${fmtSol(RUG_PRIZE_LAMPORTS)} SOL`, tone: "penalty" };
  }
  if (PUMP_TILES.has(index)) {
    return { label: "Random Pump", detail: `Next prize jumps to ${fmtSol(PUMP_PRIZE_LAMPORTS)} SOL`, tone: "boost" };
  }
  return null;
}

/** An effect tile paired with its board index, for list rendering. */
export interface EffectTileEntry extends TileEffect {
  index: number;
}

/**
 * Every tile carrying an effect, in board order. Derived by scanning
 * `effectForTile` rather than by a second hand-written list, so the rules UI
 * can never drift from the table the program mirrors. Random Pump appears
 * three times (7, 22, 36) and Gas Fee / Slippage Tax are distinct tiles --
 * callers wanting one row per *rule* should group by `label`.
 */
export function effectTiles(): EffectTileEntry[] {
  const out: EffectTileEntry[] = [];
  for (let i = 0; i < NUM_TILES; i++) {
    const effect = effectForTile(i);
    if (effect) out.push({ index: i, ...effect });
  }
  return out;
}

/** One entry per distinct rule, each carrying the tiles it applies to.
 * `effectTiles()` lists Random Pump three times; this collapses it to one row
 * labelled with all three tile indices. */
export interface EffectRule extends TileEffect {
  tiles: number[];
}

export function effectRules(tone: EffectTone): EffectRule[] {
  const byLabel = new Map<string, EffectRule>();
  for (const entry of effectTiles()) {
    if (entry.tone !== tone) continue;
    const existing = byLabel.get(entry.label);
    if (existing) existing.tiles.push(entry.index);
    else byLabel.set(entry.label, { label: entry.label, detail: entry.detail, tone: entry.tone, tiles: [entry.index] });
  }
  return [...byLabel.values()];
}

/** Cheap check for "does this tile do anything special", for pad badging. */
export function hasEffect(index: number): boolean {
  return effectForTile(index) !== null;
}

/**
 * The one rule that isn't visible from any single tile's description: a
 * penalty landing throws away the GO bonus entirely rather than netting
 * against it. Kept here so the rules panel stays in step with
 * `nextPrizeForLanding`.
 */
export const PENALTY_OVERRIDES_GO_NOTE = `Penalties override the GO bonus: land on a penalty tile after passing GO and you get the penalty prize, not the +${fmtSol(GO_BONUS_LAMPORTS)} SOL.`;

/** One-line statement of the core loop, for the top of the rules panel. */
export const CORE_LOOP_NOTE =
  "Two dice roll each round and the avatar walks forward by their sum. Guess where it lands -- correct guesses split the prize.";
