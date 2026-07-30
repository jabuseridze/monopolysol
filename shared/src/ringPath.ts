/**
 * Pure math for avatar position and heading as it walks the ring.
 * No three.js dependency — feeds into 3D rendering via the consumer.
 *
 * Authority rules for callers (consumes these on every frame):
 * 1. On landing, snap to the server-provided `landedTile`, never local modular arithmetic.
 * 2. Between rounds, idle-stand at the server-provided `avatarTile` position.
 * Both make client desyncs self-heal on the next state broadcast.
 */

import { placeTile } from "./layout";
import { NUM_TILES } from "./tiles";

export interface RingPoint {
  x: number;
  z: number;
  heading: number; // radians, Y-rotation in direction of travel
}

/**
 * Position and heading of the avatar at parameter t, walking from startTile by steps tiles.
 *
 * In "step" mode (default, constant time per step): each tile takes equal time regardless of
 * spacing, reads as rhythmic, lets a step sound fire on an exact metronome, and makes total walk
 * duration exactly `steps * WALK_STEP_MS` without querying geometry.
 *
 * In "arc" mode (constant speed, arc-length-weighted): respects the actual geometry spacing.
 * Currently unused, kept as an escape hatch for later.
 *
 * @param startTile - The tile index the avatar starts on
 * @param steps - How many tiles to walk (usually dice sum, 2–12)
 * @param t - Parameter from 0 to steps (with sub-step precision). `t=0` is the start,
 *   `t=steps` is the destination. For example, `t=2.5` is halfway through the 3rd step.
 * @param mode - "step" (default) or "arc"
 * @returns Position (x, z) and heading (radians, Y-rotation in direction of travel)
 */
export function walkPoint(
  startTile: number,
  steps: number,
  t: number,
  mode: "step" | "arc" = "step",
): RingPoint {
  // Clamp t to valid range
  const clampedT = Math.max(0, Math.min(t, steps));

  if (mode === "arc") {
    return walkPointArc(startTile, steps, clampedT);
  }

  // Default: "step" mode — constant time per step
  return walkPointStep(startTile, steps, clampedT);
}

/**
 * Step mode: constant time per step. Each tile takes equal time.
 */
function walkPointStep(startTile: number, steps: number, t: number): RingPoint {
  if (steps === 0) {
    return positionAt(startTile);
  }

  // Which step are we on? (0-indexed), clamped to valid range
  const clampedStep = Math.max(0, Math.min(Math.floor(t), steps - 1));
  // Fractional part within the step [0, 1), computed from clamped step so it's correct at boundaries
  const stepFraction = t - clampedStep;

  // Tiles: current and target for this step
  const fromTile = (startTile + clampedStep) % NUM_TILES;
  const toTile = (startTile + clampedStep + 1) % NUM_TILES;

  const fromPos = positionAt(fromTile);
  const toPos = positionAt(toTile);

  // Linear interpolation between the two positions
  const x = fromPos.x + (toPos.x - fromPos.x) * stepFraction;
  const z = fromPos.z + (toPos.z - fromPos.z) * stepFraction;

  // Heading: direction from current to next tile
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  const heading = Math.atan2(dx, dz); // atan2(x, z) for Y-rotation

  return { x, z, heading };
}

/**
 * Arc mode: constant speed, arc-length-weighted interpolation.
 * Currently unused but kept as an escape hatch for future use.
 */
function walkPointArc(startTile: number, steps: number, t: number): RingPoint {
  // Compute cumulative arc lengths between consecutive tiles
  const positions: RingPoint[] = [];
  const arcLengths: number[] = [0];

  for (let i = 0; i <= steps; i++) {
    const tile = (startTile + i) % NUM_TILES;
    positions.push(positionAt(tile));

    if (i > 0) {
      const prev = positions[i - 1]!; // Non-null assertion safe due to loop structure
      const curr = positions[i]!; // Non-null assertion safe due to loop structure
      const dx = curr.x - prev.x;
      const dz = curr.z - prev.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      arcLengths.push((arcLengths[i - 1] ?? 0) + dist);
    }
  }

  const totalLength = arcLengths[steps] ?? 0;
  const targetLength = (t / steps) * totalLength;

  // Binary search for the segment containing targetLength
  let segmentIndex = 0;
  for (let i = 0; i < steps; i++) {
    if ((arcLengths[i + 1] ?? 0) >= targetLength) {
      segmentIndex = i;
      break;
    }
  }

  const segStart = arcLengths[segmentIndex] ?? 0;
  const segEnd = arcLengths[segmentIndex + 1] ?? 0;
  const segLength = segEnd - segStart;
  const segFraction = segLength > 0 ? (targetLength - segStart) / segLength : 0;

  const fromPos = positions[segmentIndex];
  const toPos = positions[segmentIndex + 1];

  if (!fromPos || !toPos) {
    // Fallback to start position if anything is missing
    return positionAt(startTile);
  }

  const x = fromPos.x + (toPos.x - fromPos.x) * segFraction;
  const z = fromPos.z + (toPos.z - fromPos.z) * segFraction;

  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  const heading = Math.atan2(dx, dz);

  return { x, z, heading };
}

/**
 * Position (x, z) of a tile's center on the ring.
 * Heading is undefined here; compute it from the direction to the next tile.
 */
function positionAt(tileIndex: number): RingPoint {
  const placement = placeTile(tileIndex);
  return {
    x: placement.x,
    z: placement.z,
    heading: 0, // Placeholder; will be computed by the caller as direction between tiles
  };
}

/** Re-export for convenience. */
export { NUM_TILES };
