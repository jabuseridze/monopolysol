"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { NUM_TILES } from "@monopoly-sol/shared";
import { GUESS_MAX, GUESS_MIN } from "@monopoly-sol/shared/effects";
import { TILE_HEIGHT, placeTile } from "./boardMath";
import { tileRegion } from "./board/atlasLayout";
import { frameGeometry } from "./padFrame";

/** Cool cyan hologram color -- pops against the warm cream board and the
 * red/orange/pink property stripes, and makes the flip to gold read as a
 * clear "you won" signal rather than blending into the art. Edge colors are
 * pushed past 1.0 so the bloom pass (threshold 0.9) picks out the rim as a
 * distinctly brighter glow than the translucent fill beneath it. */
const PAD_FILL_COLOR = new THREE.Color("#22e5ff");
const PAD_EDGE_COLOR = new THREE.Color("#22e5ff").multiplyScalar(1.7);
const WINNER_FILL_COLOR = new THREE.Color("#f5d90a");
const WINNER_EDGE_COLOR = new THREE.Color("#f5d90a").multiplyScalar(1.6);
const LABEL_COLOR = "#eafcff";
const LABEL_WINNER_COLOR = "#3a2b00";
const PAD_LIFT = 0.08; // clears the board surface + Tile.tsx's own highlight quad
const FRAME_THICKNESS = 0.12;

interface Props {
  /** Tile the avatar is currently resting on; pads sit on avatarTile+2..+12. */
  avatarTile: number;
  /** guessSum (2-12) -> backer count. */
  guessCounts: Record<number, number>;
  /** The local player's currently selected guess sum (null if none). */
  selectedSum: number | null;
  /** Guess sum matching the actual landedTile, once the round resolves. */
  winningSum: number | null;
  /** True once guessing has closed for this round. */
  disabled: boolean;
  onGuess: (sum: number) => void;
}

/** 11 hologram pads, one per dice-sum guess (2-12), placed on the ring tiles
 * the avatar would land on for each sum. Reuses Tile.tsx's hitbox + animated
 * highlight-quad pattern; adds a frame mesh for the "brighter edge glow"
 * look the bloom pass turns into a soft rim. */
export function GuessPads({ avatarTile, guessCounts, selectedSum, winningSum, disabled, onGuess }: Props) {
  const sums = useMemo(() => {
    const arr: number[] = [];
    for (let s = GUESS_MIN; s <= GUESS_MAX; s++) arr.push(s);
    return arr;
  }, []);

  return (
    <group>
      {sums.map((sum) => (
        <GuessPad
          key={sum}
          sum={sum}
          tileIndex={(avatarTile + sum) % NUM_TILES}
          count={guessCounts[sum] ?? 0}
          selected={selectedSum === sum}
          isWinner={winningSum === sum}
          disabled={disabled}
          onClick={() => onGuess(sum)}
        />
      ))}
    </group>
  );
}

interface PadProps {
  sum: number;
  tileIndex: number;
  count: number;
  selected: boolean;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}

function GuessPad({ sum, tileIndex, count, selected, isWinner, disabled, onClick }: PadProps) {
  const region = tileRegion(tileIndex);
  const pos = placeTile(tileIndex);
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const edge = useRef<THREE.MeshBasicMaterial>(null);
  const [hover, setHover] = useState(false);

  const frameGeom = useMemo(
    () => frameGeometry(region.ww * 0.9, region.wd * 0.9, FRAME_THICKNESS),
    [region.ww, region.wd],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = isWinner ? Math.sin(t * 7) * 0.15 : selected ? Math.sin(t * 3) * 0.06 : 0;

    if (fill.current) {
      fill.current.color.copy(isWinner ? WINNER_FILL_COLOR : PAD_FILL_COLOR);
      fill.current.opacity = isWinner ? 0.42 + pulse : selected ? 0.34 : hover ? 0.26 : 0.16;
    }
    if (edge.current) {
      edge.current.color.copy(isWinner ? WINNER_EDGE_COLOR : PAD_EDGE_COLOR);
      edge.current.opacity = isWinner ? 1 : selected ? 0.95 : hover ? 0.85 : 0.7;
    }
  });

  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh
        position={[0, TILE_HEIGHT + PAD_LIFT, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onClick();
        }}
      >
        <boxGeometry args={[region.ww * 0.98, 0.06, region.wd * 0.98]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh position={[0, TILE_HEIGHT + PAD_LIFT + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[region.ww * 0.9, region.wd * 0.9]} />
        <meshBasicMaterial ref={fill} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>

      <mesh
        geometry={frameGeom}
        position={[0, TILE_HEIGHT + PAD_LIFT + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial ref={edge} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Laid flat on the pad (same rotation as the fill/frame quads) rather
          than standing upright -- an unrotated <Text> faces world +Z, which
          from this board's fixed oblique camera renders as an illegible
          slanted sliver instead of a readable number. */}
      <group position={[0, TILE_HEIGHT + PAD_LIFT + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text
          fontSize={0.46}
          color={isWinner ? LABEL_WINNER_COLOR : LABEL_COLOR}
          outlineWidth={0.035}
          outlineColor={isWinner ? "#fff3c4" : "#083039"}
          anchorX="center"
          anchorY="middle"
        >
          {String(sum)}
        </Text>
        {count > 0 && (
          <Text
            position={[0, -0.42, 0]}
            fontSize={0.2}
            color="#0b3b45"
            outlineWidth={0.015}
            outlineColor="#eafcff"
            anchorX="center"
            anchorY="middle"
          >
            {count}
          </Text>
        )}
      </group>
    </group>
  );
}
