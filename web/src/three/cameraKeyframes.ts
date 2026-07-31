import * as THREE from "three";
import { walkPoint } from "@monopoly-sol/shared/ringPath";
import { BEAT_ANTICIPATION_MS, BEAT_CELEBRATION_MS, BEAT_ROLL_MS, BEAT_SUM_MS, WALK_STEP_MS } from "@monopoly-sol/shared";
import type { DrawBeatState } from "./DrawDirector";
import { placeTile } from "./boardMath";

/** Pure per-beat camera pose math for `CinematicCamera.tsx` -- split out so
 * the rig component (safety/lifecycle: disabling+restoring OrbitControls,
 * the user-interaction escape hatch) stays readable on its own. No React,
 * no side effects: given a beat state it just returns where the camera
 * should be chasing toward this frame. */
export interface CameraPose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** 0..1ish jitter amplitude to add on top this frame (impact shake). */
  shake: number;
}

const CENTER_POS = new THREE.Vector3(0, 6.5, 9.5);
const CENTER_TARGET = new THREE.Vector3(0, 2.1, 0);
const ORBIT_RADIUS = 9.5;
const ORBIT_SWEEP = Math.PI / 7.2; // ~25 degrees over the roll beat

export function desiredPose(
  beat: DrawBeatState,
  walk: { startTile: number; steps: number } | null,
  landedTile: number | null,
  prelude: { pos: THREE.Vector3; target: THREE.Vector3 },
  lockA: number,
  lockB: number,
): CameraPose {
  switch (beat.beat) {
    case "anticipation": {
      const p = easeInOut(beat.tBeat / BEAT_ANTICIPATION_MS);
      return { pos: prelude.pos.clone().lerp(CENTER_POS, p), target: prelude.target.clone().lerp(CENTER_TARGET, p), shake: 0 };
    }
    case "roll": {
      const angle = (beat.tBeat / BEAT_ROLL_MS) * ORBIT_SWEEP;
      return { pos: orbitPos(angle), target: CENTER_TARGET, shake: 0 };
    }
    case "settle": {
      const nearA = impactProximity(beat.tBeat, lockA);
      const nearB = impactProximity(beat.tBeat, lockB);
      return { pos: orbitPos(ORBIT_SWEEP), target: CENTER_TARGET, shake: Math.max(nearA * 0.06, nearB * 0.11) };
    }
    case "sum": {
      const dest = walk ? tileFraming(walk.startTile) : { pos: CENTER_POS, target: CENTER_TARGET };
      const p = easeInOut(beat.tBeat / BEAT_SUM_MS);
      return { pos: orbitPos(ORBIT_SWEEP).lerp(dest.pos, p), target: CENTER_TARGET.clone().lerp(dest.target, p), shake: 0 };
    }
    case "walk": {
      if (!walk) return { pos: prelude.pos, target: prelude.target, shake: 0 };
      const elapsedSteps = beat.tBeat / WALK_STEP_MS;
      const p = walkPoint(walk.startTile, walk.steps, elapsedSteps);
      const behindX = -Math.sin(p.heading) * 6;
      const behindZ = -Math.cos(p.heading) * 6;
      return {
        pos: new THREE.Vector3(p.x + behindX, 5.2, p.z + behindZ),
        target: new THREE.Vector3(p.x, 1.2, p.z),
        shake: 0,
      };
    }
    case "landing": {
      const t = landedTile != null ? placeTile(landedTile) : { x: 0, z: 0 };
      const near = impactProximity(beat.tBeat, 0);
      return { pos: new THREE.Vector3(t.x + 4, 4.6, t.z + 5), target: new THREE.Vector3(t.x, 1, t.z), shake: near * 0.14 };
    }
    case "celebration": {
      const t = landedTile != null ? placeTile(landedTile) : { x: 0, z: 0 };
      const p = beat.tBeat / BEAT_CELEBRATION_MS;
      const pushIn = p < 0.4 ? easeInOut(p / 0.4) : 1 - easeInOut(Math.min(1, (p - 0.4) / 0.6));
      const near = new THREE.Vector3(t.x + 2.2, 2.6, t.z + 2.6);
      const nearTarget = new THREE.Vector3(t.x, 1, t.z);
      return { pos: near.lerp(prelude.pos, 1 - pushIn), target: nearTarget.lerp(prelude.target, 1 - pushIn), shake: 0 };
    }
    default:
      return { pos: prelude.pos, target: prelude.target, shake: 0 };
  }
}

function orbitPos(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * ORBIT_RADIUS, 6.5, Math.cos(angle) * ORBIT_RADIUS);
}

function tileFraming(tile: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const p = placeTile(tile);
  return { pos: new THREE.Vector3(p.x + 5, 5.6, p.z + 6), target: new THREE.Vector3(p.x, 1.2, p.z) };
}

function impactProximity(tBeat: number, lockMs: number): number {
  const d = Math.abs(tBeat - lockMs);
  return Math.max(0, 1 - d / 220);
}

function easeInOut(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
