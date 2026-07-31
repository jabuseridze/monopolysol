"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { BEAT_SUM_MS } from "@monopoly-sol/shared";

interface Props {
  sum: number | null;
  /** Epoch ms the "sum" beat begins (`drawResult.at + BEAT_SUM_AT_MS`);
   * `null` while inactive. */
  triggerAt: number | null;
}

const GOLD = "#ffe27a";
const POP_IN_FRAC = 0.28; // fraction of the beat spent popping in
const FADE_OUT_FRAC = 0.3; // fraction spent shrinking back out at the end
const BASE_SCALE = 1.8;

/**
 * Beat 4 ("The sum"): a large billboarded number pops above the dice, holds,
 * then shrinks away. Scale-driven rather than opacity-driven -- animating
 * troika-three-text's fill opacity per-frame is fiddly to drive reliably; a
 * scale punch reads just as clearly as a "pop" for a ~1s beat, and a shrink
 * to zero reads just as clearly as a fade for the exit.
 */
export function SumFlare({ sum, triggerAt }: Props) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (triggerAt == null || sum == null) {
      g.visible = false;
      return;
    }

    const p = (Date.now() - triggerAt) / BEAT_SUM_MS;
    g.visible = p >= 0 && p < 1;
    if (!g.visible) return;

    let scale: number;
    if (p < POP_IN_FRAC) {
      scale = easeOutBack(p / POP_IN_FRAC);
    } else if (p > 1 - FADE_OUT_FRAC) {
      scale = Math.max(0, 1 - (p - (1 - FADE_OUT_FRAC)) / FADE_OUT_FRAC);
    } else {
      scale = 1;
    }
    g.scale.setScalar(scale * BASE_SCALE);
  });

  return (
    <group ref={group} position={[0, 4.6, 0]} visible={false}>
      <Billboard>
        <Text
          fontSize={1.3}
          color={GOLD}
          outlineWidth={0.06}
          outlineColor="#5c3d00"
          anchorX="center"
          anchorY="middle"
        >
          {sum != null ? String(sum) : ""}
        </Text>
      </Billboard>
    </group>
  );
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = Math.min(1, Math.max(0, x));
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
