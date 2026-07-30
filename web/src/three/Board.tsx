"use client";

import { useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { RoundPhase, TILES } from "@monopoly-sol/shared";
import * as THREE from "three";
import { BOARD_SIDE, TILE_HEIGHT, placeTile } from "./boardMath";
import { PALETTE } from "./palette";
import { Tile } from "./Tile";
import { tileRegion } from "./board/atlasLayout";

interface Props {
  pickCounts: Record<number, number>;
  selected: number | null;
  winningTile: number | null;
  phase: RoundPhase;
  onPick: (i: number) => void;
}

/** Painted board art as one flat surface + per-tile hitboxes for picking. */
export function Board({ pickCounts, selected, winningTile, phase, onPick }: Props) {
  const texture = useTexture("/board/board-art.png");

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <group>
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <boxGeometry args={[BOARD_SIDE + 0.9, 0.5, BOARD_SIDE + 0.9]} />
        <meshStandardMaterial color={PALETTE.base} roughness={0.9} />
      </mesh>

      <mesh receiveShadow castShadow position={[0, TILE_HEIGHT / 2, 0]}>
        <boxGeometry args={[BOARD_SIDE, TILE_HEIGHT, BOARD_SIDE]} />
        <meshStandardMaterial color="#f3ead6" roughness={0.85} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_HEIGHT + 0.01, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIDE, BOARD_SIDE]} />
        <meshStandardMaterial map={texture} roughness={0.75} metalness={0.05} />
      </mesh>

      {TILES.map((tile) => {
        const t = placeTile(tile.index);
        return (
          <Tile
            key={tile.index}
            tile={tile}
            region={tileRegion(tile.index)}
            position={[t.x, 0, t.z]}
            count={pickCounts[tile.index] ?? 0}
            selected={selected === tile.index}
            isWinner={winningTile === tile.index}
            drawing={phase === "drawing"}
            onPick={onPick}
          />
        );
      })}
    </group>
  );
}
