/**
 * True Monopoly-ring geometry: large square corners and 9 narrow rectangular
 * tiles per side that sit flush against each other (no grid gaps). Returns
 * world-space placement so the 3D renderer just drops a box at each spot.
 *
 * Winding: index 0 (GO) at the bottom-right corner, increasing counter-clockwise
 * -> bottom edge right->left -> up the left side -> across the top -> down the
 * right side back toward GO. Local +Z of each tile faces outward.
 */

import { NUM_TILES } from "./tiles";

export type BoardSide = "bottom" | "left" | "top" | "right";

export const CORNER_SIZE = 2.4; // square corner tiles
export const EDGE_WIDTH = 1.55; // narrow edge tiles (~0.65 * corner)
export const RING_DEPTH = 2.4; // inward depth of every ring tile
export const BOARD_SIDE = 2 * CORNER_SIZE + 9 * EDGE_WIDTH; // 18.75
export const INNER_SIZE = BOARD_SIDE - 2 * RING_DEPTH; // 13.95

const HALF = BOARD_SIDE / 2;
const CORNER = HALF - CORNER_SIZE / 2; // corner tile center offset
const EDGE_START = HALF - CORNER_SIZE; // where the edge run begins

export interface TilePlacement {
  index: number;
  x: number;
  z: number;
  /** Extent along the ring direction. */
  width: number;
  /** Extent pointing inward. */
  depth: number;
  rotationY: number;
  side: BoardSide;
  isCorner: boolean;
}

/** Center coordinate of the k-th edge tile (k = 0..8) measured along its side. */
function edgeCoord(k: number): number {
  return EDGE_START - (k + 0.5) * EDGE_WIDTH;
}

export function placeTile(index: number): TilePlacement {
  const i = ((index % NUM_TILES) + NUM_TILES) % NUM_TILES;
  const corner = (x: number, z: number, side: BoardSide): TilePlacement => ({
    index: i, x, z, width: CORNER_SIZE, depth: CORNER_SIZE, rotationY: rot(side), side, isCorner: true,
  });
  const edge = (x: number, z: number, side: BoardSide): TilePlacement => ({
    index: i, x, z, width: EDGE_WIDTH, depth: RING_DEPTH, rotationY: rot(side), side, isCorner: false,
  });

  if (i === 0) return corner(CORNER, CORNER, "bottom");
  if (i === 10) return corner(-CORNER, CORNER, "left");
  if (i === 20) return corner(-CORNER, -CORNER, "top");
  if (i === 30) return corner(CORNER, -CORNER, "right");

  if (i < 10) return edge(edgeCoord(i - 1), CORNER, "bottom"); // right -> left
  if (i < 20) return edge(-CORNER, edgeCoord(i - 11), "left"); // bottom -> top
  if (i < 30) return edge(-edgeCoord(i - 21), -CORNER, "top"); // left -> right
  return edge(CORNER, -edgeCoord(i - 31), "right"); // top -> bottom
}

/** Outward-facing Y rotation so local +Z points away from board center. */
function rot(side: BoardSide): number {
  switch (side) {
    case "bottom": return 0;
    case "right": return Math.PI / 2;
    case "top": return Math.PI;
    case "left": return -Math.PI / 2;
  }
}
