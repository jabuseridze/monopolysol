"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** A little Community Chest treasure chest that gently bobs. */
export function Chest({ position }: { position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * 1.4) * 0.06;
  });

  return (
    <group ref={g} position={position} scale={1.1}>
      {/* Body */}
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.3, 0.6, 0.85]} />
        <meshStandardMaterial color="#7a4a1e" />
      </mesh>
      {/* Lid */}
      <mesh castShadow position={[0, 0.68, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 1.3, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#8a5623" />
      </mesh>
      {/* Metal bands */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.42, 0]}>
          <boxGeometry args={[0.1, 0.95, 0.9]} />
          <meshStandardMaterial color="#d9a441" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Lock */}
      <mesh position={[0, 0.34, 0.45]}>
        <boxGeometry args={[0.22, 0.26, 0.08]} />
        <meshStandardMaterial color="#f5c542" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}
