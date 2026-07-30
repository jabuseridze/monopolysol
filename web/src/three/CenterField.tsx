"use client";

import { Text } from "@react-three/drei";
import { INNER_SIZE } from "./boardMath";
import { PALETTE } from "./palette";
import { Chest } from "./Chest";
import { CardDeck } from "./CardDeck";

const R = INNER_SIZE * 0.42;

/** The layered center: green turf, two salmon stadium arcs with brick borders,
 * a red wordmark banner, and the Community Chest + Chance props. */
export function CenterField() {
  return (
    <group>
      {/* Turf */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[INNER_SIZE, INNER_SIZE]} />
        <meshStandardMaterial color={PALETTE.turf} />
      </mesh>

      {[-1, 1].map((sign) => (
        <group key={sign} position={[0, 0, sign * INNER_SIZE * 0.15]} rotation={[-Math.PI / 2, 0, sign < 0 ? 0 : Math.PI]}>
          <mesh position={[0, 0, 0.05]}>
            <ringGeometry args={[R - 0.02, R + 0.3, 56, 1, 0, Math.PI]} />
            <meshStandardMaterial color={PALETTE.brick} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <circleGeometry args={[R, 56, 0, Math.PI]} />
            <meshStandardMaterial color={PALETTE.arc} />
          </mesh>
        </group>
      ))}

      {/* Community Chest prop (top arc) + Chance deck (bottom arc) */}
      <Chest position={[0, 0.08, -INNER_SIZE * 0.3]} />
      <CardDeck position={[0, 0.08, INNER_SIZE * 0.3]} />

      {/* Red center banner with wordmark */}
      <group position={[0, 0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[INNER_SIZE * 0.62, 0.22, INNER_SIZE * 0.2]} />
          <meshStandardMaterial color={PALETTE.banner} />
        </mesh>
        <Text
          position={[0, 0.13, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={INNER_SIZE * 0.11}
          color={PALETTE.bannerText}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor={PALETTE.banner}
          letterSpacing={0.02}
        >
          MONOPOLY
        </Text>
      </group>
    </group>
  );
}
