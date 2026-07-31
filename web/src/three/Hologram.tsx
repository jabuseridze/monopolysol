"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundPhase } from "@monopoly-sol/shared";
import { placeTile, TILE_HEIGHT } from "./boardMath";

interface Props {
  phase: RoundPhase;
  landedTile: number | null;
  /** Epoch ms the avatar's walk animation finished (null until then). */
  landedAt: number | null;
}

const BEAM_Y = 3.2;
const BEAT_SEC = 1.4; // extra emphasis right after landing, decays over this window

/**
 * Yellow holographic beam that settles onto the tile the avatar just landed
 * on, as a landing-emphasis marker. Previously a roulette-style scanner that
 * spun across every tile before the pivot -- the server now drives an actual
 * dice-roll + avatar-walk sequence (see `Dice.tsx` / `Avatar.tsx`), so
 * there's nothing left to spin through; this just eases onto the final spot
 * and pulses.
 */
export function Hologram({ phase, landedTile, landedAt }: Props) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const drawn = phase === "drawing" || phase === "settled";
    const started = landedAt != null && Date.now() >= landedAt;
    const visible = drawn && landedTile != null && started;
    g.visible = visible;
    if (!visible || landedTile == null || landedAt == null) return;

    const p = placeTile(landedTile);
    // Ease onto the tile rather than snapping, so it reads as "settling."
    g.position.lerp(new THREE.Vector3(p.x, BEAM_Y, p.z), 0.4);
    if (ring.current) ring.current.rotation.y = state.clock.elapsedTime * 4;

    const beat = Math.max(0, 1 - (Date.now() - landedAt) / 1000 / BEAT_SEC);
    const pulseAmount = 0.4 + 0.6 * beat; // strong right after landing, settles to a gentle idle glow
    g.scale.setScalar(1.15 + Math.sin(state.clock.elapsedTime * 5) * 0.12 * pulseAmount);
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
