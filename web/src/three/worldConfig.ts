/** Static layout data for the low-poly diorama surrounding the board. */

export const GROUND_Y = -0.5;

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
  trim: string;
  /** 0 = flat slab roof, 1 = slight overhang tower feel */
  style: 0 | 1 | 2;
}

export interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  leaf: string;
}

export interface PatchSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
}

const T = "#fff6e8";

/**
 * The camera looks down the +X/+Z diagonal, so anything standing in that
 * quadrant is between it and the board's GO corner. Three buildings used to
 * live there; at the old close framing they sat outside the frustum, but once
 * `FitCamera` pulled back far enough to show the whole board, their roofs
 * loomed across the near corner as a big featureless slab. They've been moved
 * around to the far and side arcs, where they read as skyline instead.
 *
 * Rule of thumb when adding scenery: keep `x > 6 && z > 6` clear.
 */
export const BUILDINGS: BuildingSpec[] = [
  { x: -16, z: -14, w: 5, d: 5, h: 8, color: "#f2c6c6", roof: "#c9736b", trim: T, style: 1 },
  { x: -10, z: -18, w: 4, d: 4, h: 5, color: "#c6d8f2", roof: "#6b8ec9", trim: T, style: 0 },
  { x: -18, z: -4, w: 4.5, d: 6, h: 6.5, color: "#f7e3b0", roof: "#c9a24b", trim: T, style: 2 },
  { x: 16, z: -15, w: 5.5, d: 5, h: 9.5, color: "#cfeccf", roof: "#6bab74", trim: T, style: 1 },
  { x: 12, z: -19, w: 3.8, d: 4, h: 5.5, color: "#e6cff2", roof: "#8f6bc9", trim: T, style: 0 },
  { x: 19, z: -3, w: 5, d: 5, h: 7, color: "#f2d9b0", roof: "#c98f4b", trim: T, style: 2 },
  { x: -17, z: 13, w: 5, d: 5, h: 6.5, color: "#c6d8f2", roof: "#6b8ec9", trim: T, style: 0 },
  { x: -11, z: 18, w: 4.5, d: 4.5, h: 5.2, color: "#f2c6c6", roof: "#c9736b", trim: T, style: 1 },
  { x: -6, z: -25, w: 5, d: 5.5, h: 8.5, color: "#f7e3b0", roof: "#c9a24b", trim: T, style: 1 },
  { x: 5, z: -27, w: 4, d: 4, h: 4.8, color: "#cfeccf", roof: "#6bab74", trim: T, style: 0 },
  { x: -20, z: 4, w: 3.5, d: 3.5, h: 11, color: "#dde8f5", roof: "#5a7aaa", trim: T, style: 1 },
  { x: 26, z: -12, w: 4, d: 4.5, h: 6, color: "#f8d4c8", roof: "#d4785c", trim: T, style: 2 },
];

export const TREES: TreeSpec[] = [
  { x: -12, z: -9, scale: 1.1, leaf: "#3d9b4a" },
  { x: 12, z: -9, scale: 1.3, leaf: "#5cbc5f" },
  { x: -13, z: 8, scale: 1.0, leaf: "#2f8a40" },
  { x: 13, z: 8, scale: 1.2, leaf: "#3d9b4a" },
  { x: -8, z: 13, scale: 0.9, leaf: "#5cbc5f" },
  { x: 8, z: -13, scale: 1.0, leaf: "#2f8a40" },
  { x: 21, z: 6, scale: 1.2, leaf: "#3d9b4a" },
  { x: -21, z: 4, scale: 1.1, leaf: "#5cbc5f" },
  { x: -15, z: -20, scale: 0.95, leaf: "#2f8a40" },
  { x: -20, z: -16, scale: 1.05, leaf: "#3d9b4a" },
];

/** Darker grass patches for ground variation. */
export const PATCHES: PatchSpec[] = [
  { x: -8, z: -22, w: 9, d: 5, color: "#5fa85c" },
  { x: 10, z: -24, w: 7, d: 4, color: "#6bb068" },
  { x: -22, z: 6, w: 5, d: 8, color: "#5fa85c" },
  { x: 24, z: -6, w: 6, d: 7, color: "#6bb068" },
  { x: 6, z: 22, w: 8, d: 5, color: "#5fa85c" },
  { x: -14, z: 20, w: 6, d: 4, color: "#6bb068" },
];
