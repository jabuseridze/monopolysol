"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEAT_WALK_AT_MS, WALK_STEP_MS } from "@monopoly-sol/shared";
import { walkPoint } from "@monopoly-sol/shared/ringPath";
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
}

interface Props {
  /** Tile to idle-stand on between rounds (also the walk's arrival tile,
   * since the server advances this the moment a round enters "drawing"). */
  avatarTile: number;
  /** True once the round has entered its draw. The server advances
   * `avatarTile` to the LANDING tile in the same breath as it flips the
   * phase, and that broadcast is a separate socket message from the one
   * carrying the walk -- so in the gap between them `avatarTile` is already
   * the answer while `walk` is still null. Holding position through that
   * gap keeps the avatar from teleporting to its destination early. */
  drawing: boolean;
  walk: AvatarWalk | null;
  /** Master choreography clock -- `drawResult.at`. The walk beat starts at
   * `BEAT_WALK_AT_MS` past it, after the dice have rolled and settled. */
  drawResultAt: number | null;
  landedTile: number | null;
}

/** Height of the per-step hop arc. The walk used to be a flat lerp between
 * tile centres, which read as gliding; a small hop gives each step weight. */
const HOP_HEIGHT = 0.22;

type AnimState = "idle" | "walking" | "cheer";

/** The single shared avatar. Consumes `walkPoint()` to animate from
 * `walk.startTile` by `walk.steps` tiles, converging via `lerp` rather than
 * snapping so a stuttering or late-joining client catches up smoothly. Once
 * the walk's time budget elapses it snaps exactly to the server-provided
 * `landedTile` (never recomputed locally) and celebrates with a one-shot
 * Cheer -- on *every* landing, since the landing is the payoff moment of the
 * round regardless of which tile it happens to be. */
export function Avatar({ avatarTile, walk, drawing, drawResultAt, landedTile }: Props) {
  const root = useRef<THREE.Group>(null);
  // Last tile we rested on with no draw in flight -- used to hold position if
  // the phase flips to "drawing" before the walk data lands.
  const lastIdleTile = useRef(avatarTile);
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

    // The walk is one beat of the draw choreography, starting once the dice
    // have rolled and settled -- all offsets from the one master clock.
    const walkAt = drawResultAt != null ? drawResultAt + BEAT_WALK_AT_MS : null;
    const totalMs = walk ? walk.steps * WALK_STEP_MS : 0;
    const now = Date.now();
    const elapsed = walkAt != null ? now - walkAt : -1;
    const walking = walk != null && elapsed >= 0 && elapsed < totalMs;

    if (walking && walk) {
      const elapsedSteps = elapsed / WALK_STEP_MS;
      const p = walkPoint(walk.startTile, walk.steps, elapsedSteps);
      if (stateRef.current !== "walking") {
        stateRef.current = "walking";
        crossfadeTo(CLIP_WALK, false);
      }
      // Hop arc within each step: a half-sine that returns to zero exactly
      // on every footfall, so the avatar never floats between tiles.
      const hop = Math.sin((elapsedSteps % 1) * Math.PI) * HOP_HEIGHT;
      g.position.lerp(new THREE.Vector3(p.x, GROUND_Y + hop, p.z), 0.4);
      g.rotation.y = p.heading;
      return;
    }

    // Before the walk beat, between rounds, or once the walk's budget has
    // elapsed: rest exactly on the server's tile (never local modular
    // arithmetic), so a stuttering client or refresh self-heals.
    const preWalk = walk != null && elapsed < 0;
    let restTile: number;
    if (preWalk) {
      restTile = walk!.startTile;
    } else if (walk != null) {
      restTile = landedTile ?? avatarTile;
    } else if (drawing) {
      // Draw has started but the walk hasn't reached us yet: `avatarTile` is
      // already the destination, so trust the last pre-draw position instead.
      restTile = lastIdleTile.current;
    } else {
      restTile = avatarTile;
      lastIdleTile.current = avatarTile;
    }
    const rest = placeTile(restTile);
    g.position.set(rest.x, GROUND_Y, rest.z);

    if (walk != null && !preWalk && walkAt != null && handledWalkAt.current !== walkAt) {
      handledWalkAt.current = walkAt;
      // Cheer on every landing -- it's the payoff moment of the round no
      // matter which tile it happens to be, not just the 4 effect tiles.
      stateRef.current = "cheer";
      crossfadeTo(CLIP_CHEER, true);
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
