"use client";

import { BuildingSpec, GROUND_Y } from "./worldConfig";
import { PALETTE } from "./palette";

/** Pastel building with trim band, roof variety, door, and glowing windows. */
export function Building({ spec }: { spec: BuildingSpec }) {
  const { x, z, w, d, h, color, roof, trim, style } = spec;
  const rows = Math.max(2, Math.floor(h / 2.1));
  const cols = style === 1 ? 2 : 3;
  const windows: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wy = GROUND_Y + 1.2 + r * (h / rows) * 0.82;
      const wx = -w / 2 + (c + 1) * (w / (cols + 1));
      windows.push(
        <mesh key={`${r}-${c}`} position={[wx, wy, d / 2 + 0.02]}>
          <boxGeometry args={[w * 0.14, 0.45, 0.06]} />
          <meshStandardMaterial
            color={PALETTE.windowGlow}
            emissive={PALETTE.windowGlow}
            emissiveIntensity={0.55}
          />
        </mesh>
      );
    }
  }

  const roofY = GROUND_Y + h + (style === 1 ? 0.35 : 0.18);
  const roofArgs: [number, number, number] =
    style === 1 ? [w + 0.2, 0.7, d + 0.2] : style === 2 ? [w + 0.55, 0.28, d + 0.55] : [w + 0.35, 0.28, d + 0.35];

  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, GROUND_Y + h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Mid trim band */}
      <mesh position={[0, GROUND_Y + h * 0.38, d / 2 + 0.015]}>
        <boxGeometry args={[w * 1.02, 0.22, 0.05]} />
        <meshStandardMaterial color={trim} roughness={0.7} />
      </mesh>
      {/* Door */}
      <mesh position={[0, GROUND_Y + 0.7, d / 2 + 0.02]}>
        <boxGeometry args={[w * 0.22, 1.2, 0.08]} />
        <meshStandardMaterial color="#5a3a28" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, roofY, 0]}>
        <boxGeometry args={roofArgs} />
        <meshStandardMaterial color={roof} roughness={0.8} />
      </mesh>
      {windows}
    </group>
  );
}
