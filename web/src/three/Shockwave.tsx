"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Epoch ms this shockwave should fire; `null` = never fired (inactive).
   * Re-fires any time this value changes, even to another non-null value --
   * callers just update it on each impact rather than toggling visibility. */
  triggerAt: number | null;
  position: [number, number, number];
  color?: string;
  maxRadius?: number;
  durationMs?: number;
}

const DEFAULT_COLOR = "#fff3c4";

/**
 * Expanding ring pulse flat on the board plane -- one reusable component for
 * every impact beat (dice locks, footfalls, the landing slam). Purely
 * parametric (radius/opacity eased off elapsed time since `triggerAt`), no
 * particle system. `meshBasicMaterial` + `toneMapped={false}` so it clears
 * the bloom threshold reliably under ACES tone mapping.
 */
export function Shockwave({
  triggerAt,
  position,
  color = DEFAULT_COLOR,
  maxRadius = 2.2,
  durationMs = 700,
}: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const firedAt = useRef<number | null>(null);

  useFrame(() => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;

    if (triggerAt != null && firedAt.current !== triggerAt) firedAt.current = triggerAt;
    if (firedAt.current == null) {
      m.visible = false;
      return;
    }

    const p = (Date.now() - firedAt.current) / durationMs;
    if (p < 0 || p > 1) {
      m.visible = false;
      return;
    }

    m.visible = true;
    const eased = 1 - Math.pow(1 - p, 2);
    const r = 0.15 + eased * maxRadius;
    m.scale.set(r, r, r);
    material.opacity = (1 - p) * 0.9;
  });

  return (
    <mesh ref={mesh} position={position} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.82, 1, 48]} />
      <meshBasicMaterial ref={mat} color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
