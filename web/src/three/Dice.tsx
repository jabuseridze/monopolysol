"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DICE_TUMBLE_MS } from "@monopoly-sol/shared";
import { dieFaceMaterials, landingQuaternion } from "./dicePips";

export interface DiceValues {
  a: number;
  b: number;
  /** Epoch ms the tumble started, timed the same way `Hologram.tsx` drives
   * its spin: `(Date.now() - at) / 1000` against `DICE_TUMBLE_MS`. */
  at: number;
}

interface Props {
  dice: DiceValues | null;
  /** World (x, z) to hover the dice above -- the avatar's tile at roll time. */
  origin: { x: number; z: number };
}

const SIZE = 0.5;
const GAP = 0.65;
const HOVER_Y = 1.7;
const DROP_HEIGHT = 2.5; // extra height at tumble start, eases down to HOVER_Y
const SPIN_TURNS = 4; // full rotations burned off over the tumble

/**
 * Two procedurally-built cubes (no sourced dice model/texture) that tumble
 * on a random axis, decelerate, and snap exactly to the server-committed
 * `diceA`/`diceB` -- `landingQuaternion` guarantees the final orientation is
 * exact, not merely "looks random."
 */
export function Dice({ dice, origin }: Props) {
  const groupA = useRef<THREE.Group>(null);
  const groupB = useRef<THREE.Group>(null);
  const materials = useMemo(() => dieFaceMaterials(), []);
  const axisA = useMemo(() => randomAxis(), [dice?.at]);
  const axisB = useMemo(() => randomAxis(), [dice?.at]);

  useFrame(() => {
    if (!dice) return;
    const p = Math.min((Date.now() - dice.at) / DICE_TUMBLE_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3); // decelerate, matches Hologram.tsx
    placeDie(groupA.current, dice.a, eased, axisA, origin.x - GAP / 2, origin.z);
    placeDie(groupB.current, dice.b, eased, axisB, origin.x + GAP / 2, origin.z);
  });

  return (
    <group visible={dice != null}>
      <Die groupRef={groupA} materials={materials} />
      <Die groupRef={groupB} materials={materials} />
    </group>
  );
}

function placeDie(
  group: THREE.Group | null,
  value: number,
  eased: number,
  axis: THREE.Vector3,
  x: number,
  z: number,
): void {
  if (!group) return;
  const spinAngle = (1 - eased) * SPIN_TURNS * Math.PI * 2;
  const spin = new THREE.Quaternion().setFromAxisAngle(axis, spinAngle);
  group.quaternion.copy(spin.multiply(landingQuaternion(value)));
  group.position.set(x, HOVER_Y + (1 - eased) * DROP_HEIGHT, z);
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
