"use client";

import { ATLAS_PX, tileRegion } from "@/three/board/atlasLayout";
import type { BoardSide } from "@monopoly-sol/shared";

/**
 * Real pixel width of `/board/board-art.png`. `ATLAS_PX` is the *world-space*
 * atlas resolution the UV maths is written against (2048); the shipped file is
 * half that. Three.js never notices -- it consumes normalised UVs -- but a CSS
 * sprite works in pixels, so cropping at the declared 2048 would slice the
 * wrong quarter of the board.
 */
const FILE_PX = 1024;
const ATLAS_TO_FILE = FILE_PX / ATLAS_PX;

/**
 * Rotation that puts a tile the right way up.
 *
 * These are the SAME sign as `rot()` in `shared/src/layout.ts`, not its
 * negative as you'd first expect -- the texture's V axis runs opposite to
 * world Z, which flips the handedness and so flips which way the side tiles
 * need turning. Verified by cropping the atlas directly: tile 30 (right) and
 * tile 38 (right) read bottom-to-top and need +90; tile 22 (top) reads
 * inverted and needs 180; tile 0 (bottom) is already upright.
 *
 * If the board art is ever regenerated, re-check this table against real
 * crops rather than re-deriving it -- getting it wrong renders a tile
 * sideways or upside-down, which looks like a bug in the art, not the code.
 */
const UNROTATE_DEG: Record<BoardSide, number> = {
  bottom: 0,
  right: 90,
  top: 180,
  left: -90,
};

interface Props {
  /** Board tile index (0-39). */
  index: number;
  /** Rendered height in CSS px of the upright tile. Width follows the tile's
   * own aspect: corners are square, edge tiles are portrait. */
  height: number;
}

/**
 * A real picture of a board tile, cropped straight out of the board texture.
 *
 * No new asset: `/board/board-art.png` is already fetched and cached by the 3D
 * board, and `tileRegion()` is the same function that maps it onto the mesh --
 * so a tile shown here is guaranteed to be the tile the player sees in the
 * scene, including any future re-theme of the art.
 */
export function TileThumb({ index, height }: Props) {
  const region = tileRegion(index);
  const deg = UNROTATE_DEG[region.side];
  const quarterTurned = deg === 90 || deg === -90;

  // Crop rect in real file pixels.
  const cx = region.px * ATLAS_TO_FILE;
  const cy = region.py * ATLAS_TO_FILE;
  const cw = region.pw * ATLAS_TO_FILE;
  const ch = region.ph * ATLAS_TO_FILE;

  // A quarter turn swaps the crop's axes, so the height we're asked for is
  // constrained by the crop's *width* on those sides.
  const scale = height / (quarterTurned ? cw : ch);
  const uprightW = (quarterTurned ? ch : cw) * scale;

  return (
    <span className="tile-thumb" style={{ width: uprightW, height }} aria-hidden>
      <span
        className="tile-thumb-img"
        style={{
          width: cw * scale,
          height: ch * scale,
          backgroundImage: "url(/board/board-art.png)",
          backgroundSize: `${FILE_PX * scale}px ${FILE_PX * scale}px`,
          backgroundPosition: `${-cx * scale}px ${-cy * scale}px`,
          transform: `rotate(${deg}deg)`,
        }}
      />
    </span>
  );
}
