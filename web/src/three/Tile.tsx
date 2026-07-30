"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Tile as TileData } from "@monopoly-sol/shared";
import { TILE_HEIGHT } from "./boardMath";
import { tileIdleY } from "./useTileIdle";
import { TileRegion } from "./board/atlasLayout";

interface Props {
  tile: TileData;
  region: TileRegion;
  position: [number, number, number];
  count: number;
  selected: boolean;
  isWinner: boolean;
  drawing: boolean;
  onPick: (i: number) => void;
}

/** Invisible hitbox + highlight overlay; art lives on the shared board plane. */
export function Tile(p: Props) {
  const { tile, region } = p;
  const group = useRef<THREE.Group>(null);
  const hl = useRef<THREE.MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const lift = p.isWinner ? 0.55 : p.selected ? 0.22 : hover ? 0.08 : 0;
    g.position.y = lift + tileIdleY(tile.index, t) * 0.35;
    if (hl.current) {
      const on = p.isWinner || p.selected || hover;
      hl.current.opacity = p.isWinner
        ? 0.45 + Math.sin(t * 7) * 0.15
        : p.selected
          ? 0.32
          : hover
            ? 0.18
            : 0;
      hl.current.emissiveIntensity = on ? (p.isWinner ? 0.8 : 0.4) : 0;
    }
  });

  return (
    <group position={p.position}>
      <group ref={group}>
        <mesh
          position={[0, TILE_HEIGHT / 2 + 0.02, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "auto";
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!p.drawing) p.onPick(tile.index);
          }}
        >
          <boxGeometry args={[region.ww * 0.98, TILE_HEIGHT, region.wd * 0.98]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <mesh position={[0, TILE_HEIGHT + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[region.ww * 0.92, region.wd * 0.92]} />
          <meshStandardMaterial
            ref={hl}
            color={p.isWinner ? "#f5d90a" : "#4dabf7"}
            emissive={p.isWinner ? "#f5d90a" : "#4dabf7"}
            emissiveIntensity={0}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>

        {p.count > 0 && (
          <group position={[0, TILE_HEIGHT + 0.55, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial color="#f5d90a" emissive="#f5d90a" emissiveIntensity={0.4} />
            </mesh>
            <Text position={[0, 0, 0.24]} fontSize={0.26} color="#0b1020" anchorX="center" anchorY="middle">
              {String(p.count)}
            </Text>
          </group>
        )}
      </group>
    </group>
  );
}
