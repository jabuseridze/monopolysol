"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

/** An orange Chance card deck with a spinning "?" hovering above it. */
export function CardDeck({ position }: { position: [number, number, number] }) {
  const q = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (q.current) {
      q.current.rotation.y = s.clock.elapsedTime * 1.2;
      q.current.position.y = 0.95 + Math.sin(s.clock.elapsedTime * 2) * 0.08;
    }
  });

  return (
    <group position={position} scale={1.1}>
      {/* Stacked cards */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} castShadow position={[i * 0.02, 0.12 + i * 0.09, i * 0.02]}>
          <boxGeometry args={[1.15, 0.08, 0.8]} />
          <meshStandardMaterial color={i === 3 ? "#ff8a1e" : "#f2760c"} />
        </mesh>
      ))}
      {/* Floating question mark */}
      <group ref={q} position={[0, 0.95, 0]}>
        <Text fontSize={0.6} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#c85a00">
          ?
        </Text>
      </group>
    </group>
  );
}
