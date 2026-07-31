"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WALK_STEP_MS } from "@monopoly-sol/shared";
import { walkPoint } from "@monopoly-sol/shared/ringPath";
import { isCheerLanding } from "@monopoly-sol/shared/effects";
import { placeTile, TILE_HEIGHT } from "./boardMath";
import { useKayKitModel } from "./useKayKitModel";

/** Placeholder model for the shared round avatar (KayKit Knight, reused from
 * the center-field wanderer pack, scaled up). Swap this one constant for a
 * bespoke asset later. */
export const AVATAR_MODEL_URL = "/models/Knight.glb";

const SCALE = 0.95; // larger than the ~0.55-0.67 center-field wanderers
// The wanderers ground at `0.45 * scale` with no floor-height term because
// they walk the inner floor (y=0). The avatar walks the ring tiles, whose
// top surface sits at `TILE_HEIGHT + 0.01` (see Board.tsx's art plane) --
// reusing Character.tsx's bare offset here would sink the avatar's feet
// through the board.
const GROUND_Y = TILE_HEIGHT + 0.01 + 0.45 * SCALE;

const CLIP_IDLE = "Idle";
const CLIP_WALK = "Walking_A";
const CLIP_CHEER = "Cheer";
const FADE_SEC = 0.25;

export interface AvatarWalk {
  startTile: number;
  steps: number;
  /** Epoch ms the walk started -- driven the same way `Hologram.tsx` drives
   * its spin, off `(Date.now() - at) / 1000` against a known duration. */
  at: number;
}

interface Props {
  /** Tile to idle-stand on between rounds (also the walk's arrival tile,
   * since the server advances this the moment a round enters "drawing"). */
  avatarTile: number;
  walk: AvatarWalk | null;
  landedTile: number | null;
}

type AnimState = "idle" | "walking" | "cheer";

/** The single shared avatar. Consumes `walkPoint()` to animate from
 * `walk.startTile` by `walk.steps` tiles, converging via `lerp` rather than
 * snapping so a stuttering or late-joining client catches up smoothly. Once
 * the walk's time budget elapses it snaps exactly to the server-provided
 * `landedTile` (never recomputed locally) and crossfades to Idle, or to a
 * one-shot Cheer on a Random Pump tile or GO. */
export function Avatar({ avatarTile, walk, landedTile }: Props) {
  const root = useRef<THREE.Group>(null);
  const { scene, actions, names } = useKayKitModel(AVATAR_MODEL_URL);
  const stateRef = useRef<AnimState>("idle");
  const current = useRef<THREE.AnimationAction | null>(null);
  const handledWalkAt = useRef<number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      for (const clip of [CLIP_IDLE, CLIP_WALK, CLIP_CHEER]) {
        if (!names.includes(clip)) console.warn(`Avatar: expected clip "${clip}" missing from`, AVATAR_MODEL_URL);
      }
    }
    const idle = actions[CLIP_IDLE];
    idle?.reset().fadeIn(FADE_SEC).play();
    current.current = idle ?? null;
    return () => void current.current?.fadeOut(FADE_SEC);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  const crossfadeTo = (name: string, oneShot: boolean) => {
    const next = actions[name];
    if (!next || current.current === next) return;
    next.reset();
    next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    next.clampWhenFinished = oneShot;
    next.fadeIn(FADE_SEC).play();
    current.current?.fadeOut(FADE_SEC);
    current.current = next;
  };

  useFrame(() => {
    const g = root.current;
    if (!g) return;

    const totalMs = walk ? walk.steps * WALK_STEP_MS : 0;
    const now = Date.now();
    const walking = walk != null && now - walk.at < totalMs;

    if (walking && walk) {
      const elapsedSteps = (now - walk.at) / WALK_STEP_MS;
      const p = walkPoint(walk.startTile, walk.steps, elapsedSteps);
      if (stateRef.current !== "walking") {
        stateRef.current = "walking";
        crossfadeTo(CLIP_WALK, false);
      }
      g.position.lerp(new THREE.Vector3(p.x, GROUND_Y, p.z), 0.4);
      g.rotation.y = p.heading;
      return;
    }

    // Between rounds, or the walk's time budget just elapsed: rest exactly
    // on the server's tile (never local modular arithmetic), so a stuttering
    // client or a page refresh self-heals on the next broadcast.
    const restTile = walk != null ? landedTile ?? avatarTile : avatarTile;
    const rest = placeTile(restTile);
    g.position.set(rest.x, GROUND_Y, rest.z);

    if (walk != null && handledWalkAt.current !== walk.at) {
      handledWalkAt.current = walk.at;
      const cheer = landedTile != null && isCheerLanding(landedTile);
      stateRef.current = cheer ? "cheer" : "idle";
      crossfadeTo(cheer ? CLIP_CHEER : CLIP_IDLE, cheer);
    } else if (stateRef.current === "cheer" && !actions[CLIP_CHEER]?.isRunning()) {
      stateRef.current = "idle";
      crossfadeTo(CLIP_IDLE, false);
    }
  });

  return (
    <group ref={root} scale={SCALE}>
      <primitive object={scene} />
      {/* Emissive glow ring at the base so this reads as *the* shared
          avatar rather than a sixth center-field wanderer. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.55, 0.06, 12, 40]} />
        <meshStandardMaterial color="#f5d90a" emissive="#f5d90a" emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}
