"use client";

import { BOARD_SIDE } from "./boardMath";
import { PALETTE } from "./palette";
import { Building } from "./Building";
import { BUILDINGS, GROUND_Y, PATCHES, TREES } from "./worldConfig";

/** Surrounding diorama: varied ground, buildings, trees, path, stairs, lamps. */
export function World() {
  const pathR = BOARD_SIDE * 0.72;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y - 0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={0.95} />
      </mesh>

      {PATCHES.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, GROUND_Y - 0.01, p.z]} receiveShadow>
          <planeGeometry args={[p.w, p.d]} />
          <meshStandardMaterial color={p.color} roughness={0.95} />
        </mesh>
      ))}

      {/* Soft dirt path ring around the board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y - 0.005, 0]} receiveShadow>
        <ringGeometry args={[pathR, pathR + 1.8, 64]} />
        <meshStandardMaterial color={PALETTE.groundPath} roughness={0.92} />
      </mesh>

      {BUILDINGS.map((spec, i) => (
        <Building key={i} spec={spec} />
      ))}

      {TREES.map((t, i) => (
        <group key={i} position={[t.x, GROUND_Y, t.z]} scale={t.scale}>
          <mesh castShadow position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.14, 0.2, 1.1, 8]} />
            <meshStandardMaterial color={PALETTE.trunk} />
          </mesh>
          <mesh castShadow position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.85, 12, 12]} />
            <meshStandardMaterial color={t.leaf} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.35, 1.9, 0.15]}>
            <sphereGeometry args={[0.5, 10, 10]} />
            <meshStandardMaterial color={PALETTE.leafLite} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Stair terrace */}
      <group position={[-22, GROUND_Y, -12]}>
        {[0, 1, 2, 3].map((s) => (
          <mesh key={s} castShadow position={[0, 0.32 * s + 0.16, s * 0.65]}>
            <boxGeometry args={[4.2, 0.32, 4 - s * 0.65]} />
            <meshStandardMaterial color={s % 2 ? PALETTE.stone : PALETTE.stoneDark} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Path lamps */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const r = pathR + 0.9;
        return (
          <group key={i} position={[Math.cos(a) * r, GROUND_Y, Math.sin(a) * r]}>
            <mesh castShadow position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 1.8, 8]} />
              <meshStandardMaterial color="#4a5568" />
            </mesh>
            <mesh position={[0, 1.85, 0]}>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
