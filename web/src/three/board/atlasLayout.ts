import { BOARD_SIDE, BoardSide, placeTile } from "@monopoly-sol/shared";

/** Pixel size of the square board atlas texture. */
export const ATLAS_PX = 2048;
const HALF = BOARD_SIDE / 2;
const PXW = ATLAS_PX / BOARD_SIDE; // pixels per world unit

export interface TileRegion {
  index: number;
  side: BoardSide;
  isCorner: boolean;
  /** World-space extents: ww along X, wd along Z (already un-rotated). */
  ww: number;
  wd: number;
  /** Pixel rect in the atlas. */
  px: number;
  py: number;
  pw: number;
  ph: number;
  /** Normalized UV rect (flipY = false, so v grows downward like py). */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Full placement + atlas mapping for a tile index. */
export function tileRegion(index: number): TileRegion {
  const p = placeTile(index);
  const horiz = p.side === "bottom" || p.side === "top";
  const ww = horiz ? p.width : p.depth; // X extent
  const wd = horiz ? p.depth : p.width; // Z extent

  const px = (p.x - ww / 2 + HALF) * PXW;
  const py = (p.z - wd / 2 + HALF) * PXW;
  const pw = ww * PXW;
  const ph = wd * PXW;

  return {
    index,
    side: p.side,
    isCorner: p.isCorner,
    ww,
    wd,
    px,
    py,
    pw,
    ph,
    u0: px / ATLAS_PX,
    v0: py / ATLAS_PX,
    u1: (px + pw) / ATLAS_PX,
    v1: (py + ph) / ATLAS_PX,
  };
}
