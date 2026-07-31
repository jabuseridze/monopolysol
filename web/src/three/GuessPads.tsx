"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NUM_TILES } from "@monopoly-sol/shared";
import { GUESS_MAX, GUESS_MIN } from "@monopoly-sol/shared/effects";
import { TILE_HEIGHT, placeTile } from "./boardMath";
import { tileRegion } from "./board/atlasLayout";
import { frameGeometry } from "./padFrame";
import { PadChip } from "./PadChip";

/** Cool cyan hologram color -- pops against the warm cream board and the
 * red/orange/pink property stripes, and makes the flip to gold read as a
 * clear "you won" signal rather than blending into the art. Edge colors are
 * pushed past 1.0 so the bloom pass (threshold 0.9) picks out the rim as a
 * distinctly brighter glow than the translucent fill beneath it. */
const PAD_FILL_COLOR = new THREE.Color("#22e5ff");
const PAD_EDGE_COLOR = new THREE.Color("#22e5ff").multiplyScalar(1.7);
const WINNER_FILL_COLOR = new THREE.Color("#f5d90a");
const WINNER_EDGE_COLOR = new THREE.Color("#f5d90a").multiplyScalar(1.6);
const PAD_LIFT = 0.08; // clears the board surface + Tile.tsx's own highlight quad
const FRAME_THICKNESS = 0.12;
const CHIP_LIFT = 0.55; // chip floats this far above the pad surface

interface Props {
  /** Tile the avatar is currently resting on; pads sit on avatarTile+2..+12. */
  avatarTile: number;
  /** guessSum (2-12) -> backer count. */
  guessCounts: Record<number, number>;
  /** The local player's currently selected guess sum (null if none). */
  selectedSum: number | null;
  /** Guess sum matching the actual landedTile, once the round resolves. */
  winningSum: number | null;
  /** Epoch ms the avatar's walk completes. The winning pad must not flip
   * gold before this: `winningSum` is known the moment the draw is emitted,
   * so lighting it up immediately would give the answer away while the dice
   * are still in the air. Null outside a draw. */
  revealAt: number | null;
  /** True once guessing has closed for this round. */
  disabled: boolean;
  onGuess: (sum: number) => void;
}

/** 11 hologram pads, one per dice-sum guess (2-12), placed on the ring tiles
 * the avatar would land on for each sum. Reuses Tile.tsx's hitbox + animated
 * highlight-quad pattern; adds a frame mesh for the "brighter edge glow"
 * look the bloom pass turns into a soft rim. */
export function GuessPads({
  avatarTile,
  guessCounts,
  selectedSum,
  winningSum,
  revealAt,
  disabled,
  onGuess,
}: Props) {
  const sums = useMemo(() => {
    const arr: number[] = [];
    for (let s = GUESS_MIN; s <= GUESS_MAX; s++) arr.push(s);
    return arr;
  }, []);

  // `winningSum` is known the instant the draw is emitted, so flipping a pad
  // gold on it directly would announce the answer while the dice are still
  // in the air. Hold the reveal until the avatar has actually arrived.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (revealAt == null) {
      setRevealed(false);
      return;
    }
    const delay = revealAt - Date.now();
    if (delay <= 0) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const id = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(id);
  }, [revealAt]);

  return (
    <group>
      {sums.map((sum) => (
        <GuessPad
          key={sum}
          sum={sum}
          tileIndex={(avatarTile + sum) % NUM_TILES}
          count={guessCounts[sum] ?? 0}
          selected={selectedSum === sum}
          isWinner={revealed && winningSum === sum}
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
    const won = isWinner;
    const pulse = won ? Math.sin(t * 7) * 0.15 : selected ? Math.sin(t * 3) * 0.06 : 0;

    if (fill.current) {
      fill.current.color.copy(won ? WINNER_FILL_COLOR : PAD_FILL_COLOR);
      // Idle fill nudged up from 0.16 -> 0.22 so the pad reads clearly as a
      // "click here" affordance even before the chip/frame catch the eye.
      fill.current.opacity = won ? 0.42 + pulse : selected ? 0.34 : hover ? 0.28 : 0.22;
    }
    if (edge.current) {
      edge.current.color.copy(won ? WINNER_EDGE_COLOR : PAD_EDGE_COLOR);
      edge.current.opacity = won ? 1 : selected ? 0.95 : hover ? 0.85 : 0.7;
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

      {/* Billboarded chip carrying the digit, floating above the pad --
          replaces text laid flat on the tile, which collided with the board
          art's printed property names and read as an illegible sideways
          sliver from this fixed oblique camera. */}
      <PadChip
        sum={sum}
        count={count}
        selected={selected}
        hover={hover}
        isWinner={isWinner}
        liftY={TILE_HEIGHT + PAD_LIFT + CHIP_LIFT}
      />
    </group>
  );
}
