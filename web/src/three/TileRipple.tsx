"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NUM_TILES } from "@monopoly-sol/shared";
import { placeTile, TILE_HEIGHT } from "./boardMath";

interface Props {
  /** Landing tile index to radiate outward from; `null` while inactive. */
  centerTile: number | null;
  /** Epoch ms the ripple should start (the landing beat's start). */
  triggerAt: number | null;
}

const RADIUS_TILES = 6; // ring-distance outward in each direction
const DELAY_PER_TILE_MS = 45;
const POP_DURATION_MS = 380;
const POP_HEIGHT = 0.34;
const GOLD = new THREE.Color("#ffe27a").multiplyScalar(1.4);

/**
 * Sequential outward "pop" radiating from the landing tile. The board's
 * painted art is one flat texture plane (see `Board.tsx`) with no per-tile
 * geometry to physically lift, so this overlays small glowing discs above
 * each nearby ring tile instead and pops them in sequence -- reusing the
 * one-shot envelope from the dead `useTileIdle.ts` (`sin((local/dur) * pi)
 * * height`) for each disc's timing, just applied to new geometry rather
 * than to the (non-existent) tile mesh itself.
 */
export function TileRipple({ centerTile, triggerAt }: Props) {
  const group = useRef<THREE.Group>(null);
  const firedAt = useRef<number | null>(null);

  const tiles = useMemo(() => {
    if (centerTile == null) return [];
    const arr: { index: number; dist: number }[] = [];
    for (let d = 0; d <= RADIUS_TILES; d++) {
      arr.push({ index: (centerTile + d) % NUM_TILES, dist: d });
      if (d > 0) arr.push({ index: (centerTile - d + NUM_TILES) % NUM_TILES, dist: d });
    }
    return arr;
  }, [centerTile]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    if (triggerAt != null && firedAt.current !== triggerAt) firedAt.current = triggerAt;
    if (firedAt.current == null) {
      g.visible = false;
      return;
    }

    const t = Date.now() - firedAt.current;
    const windowMs = RADIUS_TILES * DELAY_PER_TILE_MS + POP_DURATION_MS;
    g.visible = t >= 0 && t < windowMs;
    if (!g.visible) return;

    g.children.forEach((child, i) => {
      const item = tiles[i];
      if (!item) return;
      const local = t - item.dist * DELAY_PER_TILE_MS;
      const p = local / POP_DURATION_MS;
      const pop = p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
      const mesh = child as THREE.Mesh;
      mesh.position.y = TILE_HEIGHT + 0.02 + pop * POP_HEIGHT;
      mesh.scale.setScalar(0.5 + pop * 0.6);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = pop * 0.85;
    });
  });

  return (
    <group ref={group} visible={false}>
      {tiles.map((t) => {
        const p = placeTile(t.index);
        return (
          <mesh key={t.index} position={[p.x, TILE_HEIGHT, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.5, 20]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}
