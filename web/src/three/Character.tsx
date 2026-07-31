"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RUN_CLIP } from "./assets";
import { useKayKitModel } from "./useKayKitModel";

const RING_MIN = 2.6;
const RING_MAX = 5.8;

interface Props {
  url: string;
  speed: number;
  seed: number;
  scale: number;
}

/** KayKit adventurer that runs between waypoints on the center track. */
export function Character({ url, speed, seed, scale }: Props) {
  const root = useRef<THREE.Group>(null);
  const { scene: cloned, actions, names } = useKayKitModel(url);
  const pos = useMemo(() => waypoint(seed), [seed]);
  const target = useRef(waypoint(seed + 1));
  const facing = useRef(0);

  useEffect(() => {
    const name =
      names.includes(RUN_CLIP) ? RUN_CLIP : names.find((n) => /Running_A|Run/i.test(n)) ?? names[0];
    const action = actions[name];
    action?.reset().fadeIn(0.2).play();
    if (action) action.timeScale = 1.15;
    return () => void action?.fadeOut(0.15);
  }, [actions, names]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const dir = target.current.clone().sub(pos);
    if (dir.length() < 0.4) target.current = waypoint(Math.random() * 1e6);
    dir.normalize();
    pos.addScaledVector(dir, speed * dt);
    const want = Math.atan2(dir.x, dir.z);
    facing.current += shortestAngle(facing.current, want) * Math.min(1, dt * 6);
    // Lift so feet sit on the board surface (KayKit feet are slightly below origin).
    g.position.set(pos.x, 0.45 * scale, pos.z);
    g.rotation.set(0, facing.current, 0);
  });

  return (
    <group ref={root} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

function waypoint(seed: number): THREE.Vector3 {
  const a = frac(seed * 0.1234) * Math.PI * 2;
  const r = RING_MIN + frac(seed * 0.789) * (RING_MAX - RING_MIN);
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}
function frac(x: number): number {
  const v = Math.sin(x * 91.17) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
