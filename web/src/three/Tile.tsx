"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { Tile as TileData } from "@monopoly-sol/shared";
import { effectForTile } from "@monopoly-sol/shared/effectCopy";
import { TILE_HEIGHT } from "./boardMath";
import { TileRegion } from "./board/atlasLayout";

interface Props {
  tile: TileData;
  region: TileRegion;
  position: [number, number, number];
}

/**
 * Invisible hitbox; art lives on the shared board plane. Picking now lives
 * in `GuessPads.tsx` -- the only thing left for these 40 per-tile hitboxes
 * to do is surface a hover tooltip naming the tile's prize effect (if it has
 * one), which teaches the effect table to players for free.
 */
export function Tile({ tile, region, position }: Props) {
  const [hover, setHover] = useState(false);
  const effect = effectForTile(tile.index);

  return (
    <group position={position}>
      <mesh
        position={[0, TILE_HEIGHT / 2 + 0.02, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!effect) return;
          setHover(true);
          document.body.style.cursor = "help";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[region.ww * 0.98, TILE_HEIGHT, region.wd * 0.98]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hover && effect && (
        <Html position={[0, TILE_HEIGHT + 0.4, 0]} center distanceFactor={8}>
          <div
            className="panel"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none" }}
          >
            <strong>{effect.label}</strong>
            <span style={{ color: "var(--muted)" }}> → {effect.detail}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
