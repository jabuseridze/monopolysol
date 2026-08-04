"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BEAT_ROLL_AT_MS,
  BEAT_SETTLE_AT_MS,
  DIE_A_LOCK_MS,
  DIE_B_LOCK_MS,
} from "@monopoly-sol/shared";
import { dieFaceMaterials, landingQuaternion } from "./dicePips";
import { TILE_HEIGHT } from "./boardMath";

export interface DiceValues {
  a: number;
  b: number;
}

interface Props {
  dice: DiceValues | null;
  /** Master choreography clock -- `drawResult.at`. All beat offsets come
   * from `shared/src/constants.ts`, so the dice can't drift from the camera. */
  drawResultAt: number | null;
}

/** ~3x the old 0.5, and rolled at the board's centre rather than hovering
 * over a corner tile. The inner playfield is a clear 13.95 square and the
 * airspace above it is empty, so there's room for dice this size. */
const SIZE = 1.45;
const GAP = 2.1;
const DROP_FROM = 12; // starts high above the board and falls in
const REST_Y = TILE_HEIGHT + SIZE / 2;
const SPIN_TURNS = 7;
const BOUNCES = 3;
const BOUNCE_DECAY = 0.42;
/** Arbitrary tilt held during the anticipation beat, so the dice show a
 * meaningless orientation rather than their committed faces before the roll. */
const PRE_ROLL_ANGLE = 0.9;

/**
 * Two procedurally-built cubes (never a sourced model -- we need to own the
 * face-to-rotation mapping so they land on the exact committed values).
 *
 * Beats: nothing until the roll begins, then a falling multi-bounce tumble,
 * then each die locks *separately* -- die A first, die B ~0.7s later. That
 * gap is the whole point: it's the held-breath moment before the sum is
 * known. Once locked, a die is perfectly still.
 */
export function Dice({ dice, drawResultAt }: Props) {
  const groupA = useRef<THREE.Group>(null);
  const groupB = useRef<THREE.Group>(null);
  const materials = useMemo(() => dieFaceMaterials(), []);
  const axisA = useMemo(() => randomAxis(), [drawResultAt]);
  const axisB = useMemo(() => randomAxis(), [drawResultAt]);

  useFrame(() => {
    if (!dice || drawResultAt == null) return;
    const t = Date.now() - drawResultAt;
    placeDie(groupA.current, dice.a, t, BEAT_SETTLE_AT_MS + DIE_A_LOCK_MS, axisA, -GAP / 2);
    placeDie(groupB.current, dice.b, t, BEAT_SETTLE_AT_MS + DIE_B_LOCK_MS, axisB, +GAP / 2);
  });

  const visible = dice != null && drawResultAt != null;
  return (
    <group visible={visible}>
      <Die groupRef={groupA} materials={materials} />
      <Die groupRef={groupB} materials={materials} />
    </group>
  );
}

/**
 * `t` and `lockAt` are ms from `drawResultAt`. Before the roll beat the die
 * waits offscreen above; between roll and lock it falls and tumbles; after
 * `lockAt` it is exactly at rest showing `value`.
 */
function placeDie(
  group: THREE.Group | null,
  value: number,
  t: number,
  lockAt: number,
  axis: THREE.Vector3,
  x: number,
): void {
  if (!group) return;

  const landed = landingQuaternion(value);

  if (t <= BEAT_ROLL_AT_MS) {
    // Wait out the anticipation beat in an ARBITRARY orientation, never the
    // landed one. The dice are already mounted and visible up here, and
    // OrbitControls allows a near-top-down view (minPolarAngle 0.15), so
    // parking them on their true faces would show the result to anyone
    // looking down at the board a second and a half before the roll starts.
    group.position.set(x, DROP_FROM, 0);
    group.quaternion.setFromAxisAngle(axis, PRE_ROLL_ANGLE);
    return;
  }
  if (t >= lockAt) {
    group.position.set(x, REST_Y, 0);
    group.quaternion.copy(landed);
    return;
  }

  const p = (t - BEAT_ROLL_AT_MS) / (lockAt - BEAT_ROLL_AT_MS);

  // Spin decays to zero exactly at the lock, so the snap is seamless.
  const spinAngle = (1 - p) * (1 - p) * SPIN_TURNS * Math.PI * 2;
  group.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axis, spinAngle).multiply(landed));

  group.position.set(x, REST_Y + bounceHeight(p) * (DROP_FROM - REST_Y), 0);
}

/**
 * Parametric bounce, no physics engine: an |sin| arc whose peaks decay
 * geometrically, so the die drops, hits, and rebounds progressively lower
 * until it's flat at p = 1.
 */
function bounceHeight(p: number): number {
  const envelope = Math.pow(1 - p, 1.55);
  const arc = Math.abs(Math.cos(p * Math.PI * (BOUNCES + 0.5)));
  return envelope * (BOUNCE_DECAY + (1 - BOUNCE_DECAY) * arc);
}

function randomAxis(): THREE.Vector3 {
  const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3(1, 1, 1).normalize();
}

function Die({
  groupRef,
  materials,
}: {
  groupRef: RefObject<THREE.Group>;
  materials: THREE.MeshStandardMaterial[];
}) {
  return (
    <group ref={groupRef}>
      <mesh castShadow material={materials}>
        <boxGeometry args={[SIZE, SIZE, SIZE]} />
      </mesh>
    </group>
  );
}
