"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NUM_TILES, RoundPhase } from "@monopoly-sol/shared";
import { placeTile, TILE_HEIGHT } from "./boardMath";

interface Props {
  phase: RoundPhase;
  landedTile: number | null;
  drawResultAt: number | null;
}

const SPIN_SECONDS = 6;
const LAPS = 3;
const BEAM_Y = 3.2;

/** Yellow holographic scanner: spins across tiles then eases onto the landed
 * tile. TODO(Task 7): this is the old tile-lottery draw choreography (a
 * roulette-style spin-and-land). The server now emits dice values + a start
 * tile (`DrawResultDTO.diceA/diceB/startTile`) for an actual dice-roll +
 * avatar-walk animation -- Task 7 likely replaces this component's whole
 * approach rather than just renaming its prop. */
export function Hologram({ phase, landedTile, drawResultAt }: Props) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const visible = phase === "locked" || phase === "drawing" || phase === "settled";

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.visible = visible;
    if (!visible) return;

    let index: number;
    if (landedTile != null && drawResultAt != null) {
      const elapsed = (Date.now() - drawResultAt) / 1000;
      const p = Math.min(elapsed / SPIN_SECONDS, 1);
      const eased = 1 - Math.pow(1 - p, 3); // decelerate
      const total = LAPS * NUM_TILES + landedTile;
      index = p >= 1 ? landedTile : Math.floor(eased * total) % NUM_TILES;
    } else {
      // Locked but not yet drawn: idle fast spin.
      index = Math.floor(state.clock.elapsedTime * 9) % NUM_TILES;
    }

    const p = placeTile(index);
    // Smoothly chase the target tile so motion never snaps.
    g.position.lerp(new THREE.Vector3(p.x, BEAM_Y, p.z), 0.4);
    if (ring.current) ring.current.rotation.y = state.clock.elapsedTime * 4;

    const landed = landedTile != null && drawResultAt != null && (Date.now() - drawResultAt) / 1000 >= SPIN_SECONDS;
    const s = landed ? 1.15 + Math.sin(state.clock.elapsedTime * 5) * 0.12 : 1;
    g.scale.setScalar(s);
  });

  return (
    <group ref={group} visible={false}>
      {/* Vertical light beam */}
      <mesh position={[0, -BEAM_Y / 2 + TILE_HEIGHT, 0]}>
        <cylinderGeometry args={[0.55, 0.9, BEAM_Y, 24, 1, true]} />
        <meshStandardMaterial
          color="#f5d90a"
          emissive="#f5d90a"
          emissiveIntensity={2.2}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Spinning base ring */}
      <mesh ref={ring} position={[0, -BEAM_Y + TILE_HEIGHT + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.08, 12, 40]} />
        <meshStandardMaterial color="#fff3a0" emissive="#f5d90a" emissiveIntensity={2.5} />
      </mesh>

      <pointLight position={[0, -BEAM_Y + TILE_HEIGHT + 1, 0]} color="#f5d90a" intensity={6} distance={8} />
    </group>
  );
}
