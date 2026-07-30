/** v1 Tile effects — prize size only, applied to the next round. */

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

/** Penalty tile indices (Gas Fee, Slippage Tax). */
const PENALTY_TILES = new Set([4, 38]);

/** Rug tile index (Get Rugged). */
const RUG_TILE = 30;

/** Pump tile indices (Random Pump). */
const PUMP_TILES = new Set([7, 22, 36]);

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
 * @param baseOrCurrentPrize - The base prize (or current round's prize if re-arming)
 * @param passedOrLandedGo - Whether the avatar passed or landed on GO
 * @returns The prize in lamports for the next round
 */
export function nextPrizeForLanding(
  landedTile: number,
  baseOrCurrentPrize: number,
  passedOrLandedGo: boolean,
): number {
  const goBonus = passedOrLandedGo ? GO_BONUS_LAMPORTS : 0;

  if (PENALTY_TILES.has(landedTile)) {
    return PENALTY_PRIZE_LAMPORTS; // Penalties suppress GO bonus
  }

  if (landedTile === RUG_TILE) {
    return RUG_PRIZE_LAMPORTS; // Rug also suppresses GO bonus
  }

  if (PUMP_TILES.has(landedTile)) {
    return PUMP_PRIZE_LAMPORTS + goBonus;
  }

  // Everything else: base prize + GO bonus
  return BASE_PRIZE_LAMPORTS + goBonus;
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
