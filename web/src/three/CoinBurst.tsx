"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Epoch ms the burst should fire; `null` = inactive. */
  triggerAt: number | null;
  position: [number, number, number];
  count?: number;
  durationMs?: number;
}

const GOLD = new THREE.Color("#ffd83d").multiplyScalar(1.6);
const GRAVITY = 9;
const COIN_SCALE = 0.24;

interface CoinLaunch {
  angle: number;
  speed: number;
  vy: number;
  spinX: number;
  spinY: number;
}

/**
 * Instanced coins erupting in ballistic arcs from the landing tile --
 * `InstancedMesh`, no physics engine. Each coin gets a random launch angle/
 * speed/spin, fixed once per mount; per-frame position is closed-form
 * projectile motion (`y = y0 + vy*t - 0.5*g*t^2`) rather than an integrated
 * simulation, so it's exactly reproducible and cheap.
 */
export function CoinBurst({ triggerAt, position, count = 24, durationMs = 1400 }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const firedAt = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const launches = useMemo<CoinLaunch[]>(
    () =>
      Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: 2.2 + Math.random() * 2.6,
        vy: 4.5 + Math.random() * 2.8,
        spinX: 8 + Math.random() * 10,
        spinY: 6 + Math.random() * 8,
      })),
    [count],
  );

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    if (triggerAt != null && firedAt.current !== triggerAt) firedAt.current = triggerAt;
    if (firedAt.current == null) {
      mesh.visible = false;
      return;
    }

    const t = (Date.now() - firedAt.current) / 1000;
    const p = t / (durationMs / 1000);
    if (p < 0 || p > 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    for (let i = 0; i < count; i++) {
      const l = launches[i]!;
      const x = position[0] + Math.cos(l.angle) * l.speed * t;
      const z = position[2] + Math.sin(l.angle) * l.speed * t;
      const y = Math.max(position[1] + l.vy * t - 0.5 * GRAVITY * t * t, position[1]);
      dummy.position.set(x, y, z);
      dummy.rotation.set(t * l.spinX, t * l.spinY, 0);
      const fade = Math.max(0, 1 - Math.pow(p, 3));
      dummy.scale.setScalar(COIN_SCALE * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} visible={false}>
      <cylinderGeometry args={[1, 1, 0.28, 12]} />
      <meshBasicMaterial color={GOLD} toneMapped={false} />
    </instancedMesh>
  );
}
