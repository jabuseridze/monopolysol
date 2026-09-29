/** v1 Tile effects -- prize size only, applied to the next round.
 *
 * Pure math only: this file mirrors `program/programs/monopoly/src/effects.rs`
 * one-for-one. Player-facing wording for these rules lives in `effectCopy.ts`. */

import { LAMPORTS_PER_SOL } from "./constants";


/** Base prize: 0.5 SOL. */
export const BASE_PRIZE_LAMPORTS = Math.round(0.5 * LAMPORTS_PER_SOL);

/** Penalty tiles: 0.25 SOL (Gas Fee #4, Slippage Tax #38). */
export const PENALTY_PRIZE_LAMPORTS = Math.round(0.25 * LAMPORTS_PER_SOL);

/** Rug tile: 0.1 SOL (Get Rugged #30). */
export const RUG_PRIZE_LAMPORTS = Math.round(0.1 * LAMPORTS_PER_SOL);

/** Pump tile: 1.0 SOL (Random Pump #7, #22, #36). */
export const PUMP_PRIZE_LAMPORTS = Math.round(1.0 * LAMPORTS_PER_SOL);

/** GO bonus: 0.1 SOL, added to non-penalty tiles. */
export const GO_BONUS_LAMPORTS = Math.round(0.1 * LAMPORTS_PER_SOL);

/**
 * The prize ladder as ratios of the base prize.
 *
 * The constants above are the ladder at its default 0.5 SOL base, and are kept
 * because tests, copy and the UI all reference them by name. These ratios are
 * what let the whole ladder be re-scaled together: running the game at a
 * tenth of the stakes has to move Random Pump and Get Rugged with it, or a
 * "cheap" round still pays a full 1 SOL the moment the avatar lands on a pump.
 */
const RATIO_PENALTY = PENALTY_PRIZE_LAMPORTS / BASE_PRIZE_LAMPORTS; // 0.5
const RATIO_RUG = RUG_PRIZE_LAMPORTS / BASE_PRIZE_LAMPORTS;         // 0.2
const RATIO_PUMP = PUMP_PRIZE_LAMPORTS / BASE_PRIZE_LAMPORTS;       // 2.0
const RATIO_GO = GO_BONUS_LAMPORTS / BASE_PRIZE_LAMPORTS;           // 0.2

/** Penalty tile indices (Gas Fee, Slippage Tax). */
export const PENALTY_TILES = new Set([4, 38]);

/** Rug tile index (Get Rugged). */
export const RUG_TILE = 30;

/** Pump tile indices (Random Pump). */
export const PUMP_TILES = new Set([7, 22, 36]);

/** GO tile index -- the only "boost" that also triggers on pass-through. */
export const GO_TILE = 0;

/**
 * Guess range for 2d6 dice (deferred effects like JAILED will override this).
 */
export const GUESS_MIN = 2;
export const GUESS_MAX = 12;

/**
 * Compute the next round's prize based on which tile was landed on and whether
 * GO was passed or landed.
 *
 * Penalties (Gas Fee, Slippage Tax, Get Rugged) override the GO bonus.
 * Everything else stacks the GO bonus when applicable.
 *
 * @param landedTile - The tile index the avatar landed on
 * @param passedOrLandedGo - Whether the avatar passed or landed on GO
 * @param baseLamports - Base prize to scale the ladder from. Defaults to
 *   `BASE_PRIZE_LAMPORTS` (0.5 SOL), which reproduces the original values
 *   exactly. Lower it to run the same game for smaller stakes -- every tile
 *   effect scales with it, so the relationships players learn stay intact.
 * @returns The prize in lamports for the next round
 */
export function nextPrizeForLanding({
  landedTile,
  passedOrLandedGo,
  baseLamports = BASE_PRIZE_LAMPORTS,
}: {
  landedTile: number;
  passedOrLandedGo: boolean;
  baseLamports?: number;
}): number {
  const goBonus = passedOrLandedGo ? Math.round(baseLamports * RATIO_GO) : 0;

  if (PENALTY_TILES.has(landedTile)) {
    return Math.round(baseLamports * RATIO_PENALTY); // Penalties suppress GO bonus
  }

  if (landedTile === RUG_TILE) {
    return Math.round(baseLamports * RATIO_RUG); // Rug also suppresses GO bonus
  }

  if (PUMP_TILES.has(landedTile)) {
    return Math.round(baseLamports * RATIO_PUMP) + goBonus;
  }

  // Everything else: base prize + GO bonus
  return baseLamports + goBonus;
}

/**
 * Compute the tile the avatar lands on and whether it passed or landed on GO.
 *
 * Handles the double-count trap: when `start + sum === numTiles`, we satisfy
 * both "passed GO" (>= numTiles) and "landed on GO" (== 0). The collapsed rule
 * is: `passed_or_landed_go = (start + sum >= numTiles) || (landed === 0)`.
 *
 * @param startTile - The avatar's current tile
 * @param sum - The dice sum (2–12)
 * @param numTiles - Total tiles on the ring (40)
 * @returns { landedTile, passedOrLandedGo }
 */
export function landingFor(
  startTile: number,
  sum: number,
  numTiles: number,
): { landedTile: number; passedOrLandedGo: boolean } {
  const landed = (startTile + sum) % numTiles;
  // Double-count collapse: landed on GO (exactly) OR passed GO (sum moved us past 40).
  const passedOrLandedGo = (startTile + sum >= numTiles) || (landed === 0);
  return { landedTile: landed, passedOrLandedGo };
}

/**
 * Probability of rolling a given sum on 2d6 (returns n/36).
 * Distribution: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1] for sums 2–12.
 *
 * @param sum - The dice sum (2–12)
 * @returns Probability as a fraction of 36
 */
export function diceSumProbability(sum: number): number {
  const counts: Record<number, number> = {
    2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
    8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
  };
  return (counts[sum] ?? 0) / 36;
}

/**
 * Tiles that warrant a one-shot "cheer" reaction from the avatar on landing:
 * Random Pump tiles boost the next prize outright, and GO adds its bonus.
 * Everything else gets a plain idle settle.
 */
export function isCheerLanding(landedTile: number): boolean {
  return landedTile === 0 || PUMP_TILES.has(landedTile);
}
