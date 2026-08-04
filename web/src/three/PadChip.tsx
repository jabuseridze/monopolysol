"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { TileEffect } from "@monopoly-sol/shared/effectCopy";

/** Same cyan/gold hologram palette as `GuessPads.tsx` -- kept in sync by eye
 * since the two files intentionally don't share color constants (this is
 * the only other place they're used). */
const FILL_COLOR = new THREE.Color("#22e5ff");
const EDGE_COLOR = new THREE.Color("#22e5ff").multiplyScalar(1.7);
const WINNER_FILL = new THREE.Color("#f5d90a");
const WINNER_EDGE = new THREE.Color("#f5d90a").multiplyScalar(1.6);
const LABEL_COLOR = "#eafcff";
const LABEL_WINNER_COLOR = "#3a2b00";

const CHIP_RADIUS = 0.34;

/** Badge colours for pads that happen to sit on an effect tile. Gold reads
 * as "good" and matches the HUD accent; the rose reads as "careful" without
 * colliding with the board art's red property stripes. Both are pushed past
 * 1.0 so the bloom pass picks them out the way it does the pad rims. */
const BADGE_BOOST = new THREE.Color("#f5d90a").multiplyScalar(1.5);
const BADGE_PENALTY = new THREE.Color("#ff5c7a").multiplyScalar(1.5);
const BADGE_RADIUS = 0.13;

interface Props {
  sum: number;
  count: number;
  selected: boolean;
  hover: boolean;
  isWinner: boolean;
  /** Effect on the tile this pad sits on, if any. Static board data -- never
   * derived from the draw result, so badging cannot leak the winner. */
  effect: TileEffect | null;
  /** World-space height (above the pad's own group origin) to float at. */
  liftY: number;
}

/**
 * Small disc, billboarded so it always faces the camera, carrying the guess
 * sum's digit. Replaces text laid flat on the tile: flat text collides with
 * the board art's printed property names (e.g. a "9" stamped through "DEGEN
 * DRIVE") and inherits the board's outward rotation, reading as an illegible
 * sideways sliver from this fixed oblique camera. Floating + billboarding is
 * the durable fix -- angle-specific tweaks to flat text keep recurring here.
 */
export function PadChip({ sum, count, selected, hover, isWinner, effect, liftY }: Props) {
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const edge = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = isWinner ? Math.sin(t * 7) * 0.15 : selected ? Math.sin(t * 3) * 0.06 : 0;
    if (fill.current) {
      fill.current.color.copy(isWinner ? WINNER_FILL : FILL_COLOR);
      fill.current.opacity = isWinner ? 0.55 + pulse : selected ? 0.5 : hover ? 0.4 : 0.32;
    }
    if (edge.current) {
      edge.current.color.copy(isWinner ? WINNER_EDGE : EDGE_COLOR);
      edge.current.opacity = isWinner ? 1 : selected ? 0.95 : hover ? 0.85 : 0.75;
    }
  });

  return (
    <Billboard position={[0, liftY, 0]}>
      <mesh>
        <circleGeometry args={[CHIP_RADIUS, 32]} />
        <meshBasicMaterial ref={fill} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[CHIP_RADIUS * 0.86, CHIP_RADIUS, 32]} />
        <meshBasicMaterial ref={edge} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0, 0.002]}
        fontSize={0.32}
        color={isWinner ? LABEL_WINNER_COLOR : LABEL_COLOR}
        outlineWidth={0.028}
        outlineColor={isWinner ? "#fff3c4" : "#083039"}
        anchorX="center"
        anchorY="middle"
      >
        {String(sum)}
      </Text>
      {count > 0 && (
        <Text
          position={[0, -CHIP_RADIUS - 0.15, 0.002]}
          fontSize={0.15}
          color="#0b3b45"
          outlineWidth={0.012}
          outlineColor="#eafcff"
          anchorX="center"
          anchorY="middle"
        >
          {count}
        </Text>
      )}

      {/* Effect badge. The pad's own hitbox sits above the tile's, so the
          board tooltip in `Tile.tsx` never fires for these 11 tiles -- the
          hover label below is what replaces it. */}
      {effect && (
        <group position={[CHIP_RADIUS * 0.82, CHIP_RADIUS * 0.82, 0.003]}>
          <mesh>
            <circleGeometry args={[BADGE_RADIUS, 20]} />
            <meshBasicMaterial
              color={effect.tone === "boost" ? BADGE_BOOST : BADGE_PENALTY}
              transparent
              opacity={0.95}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <Text position={[0, 0.005, 0.001]} fontSize={0.17} color="#0b1020" anchorX="center" anchorY="middle">
            {effect.tone === "boost" ? "+" : "-"}
          </Text>
        </group>
      )}
      {effect && hover && (
        <Text
          position={[0, CHIP_RADIUS + 0.28, 0.002]}
          fontSize={0.15}
          maxWidth={3}
          textAlign="center"
          color="#eafcff"
          outlineWidth={0.014}
          outlineColor="#083039"
          anchorX="center"
          anchorY="middle"
        >
          {effect.label}
        </Text>
      )}
    </Billboard>
  );
}
