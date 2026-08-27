import {
  BOARD_SIDE,
  CORNER_SIZE,
  EDGE_WIDTH,
  INNER_SIZE,
  RING_DEPTH,
  placeTile,
} from "@monopoly-sol/shared";

export const TILE_HEIGHT = 0.42;
/** Half-extent of the board from center to outer edge. */
export const BOARD_HALF = BOARD_SIDE / 2;

export { BOARD_SIDE, INNER_SIZE, CORNER_SIZE, EDGE_WIDTH, RING_DEPTH, placeTile };
