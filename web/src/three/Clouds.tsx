"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_HALF } from "./boardMath";

interface Puff {
  pos: [number, number, number];
  scale: number;
  drift: number;
}

/** Soft puffy clouds that fade in during the draw and slowly drift. */
export function CloudLayer({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const opacity = useRef(0);

  const puffs = useMemo<Puff[]>(() => {
    const arr: Puff[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = BOARD_HALF * (0.7 + Math.random() * 0.5);
      arr.push({
        pos: [Math.cos(a) * r, 5 + Math.random() * 3, Math.sin(a) * r],
        scale: 1.6 + Math.random() * 1.8,
        drift: 0.1 + Math.random() * 0.2,
      });
    }
    return arr;
  }, []);

  useFrame((state, dt) => {
    const target = active ? 0.85 : 0;
    opacity.current += (target - opacity.current) * Math.min(1, dt * 2.5);
    const g = group.current;
    if (!g) return;
    g.visible = opacity.current > 0.01;
    g.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = opacity.current;
      mesh.position.y = puffs[i].pos[1] + Math.sin(state.clock.elapsedTime * puffs[i].drift + i) * 0.4;
      mesh.rotation.y += dt * puffs[i].drift * 0.5;
    });
  });

  return (
    <group ref={group} visible={false}>
      {puffs.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.scale}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#e9edf7"
            transparent
            opacity={0}
            roughness={1}
            flatShading
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
