"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { computeDrawBeat } from "./DrawDirector";
import { desiredPose } from "./cameraKeyframes";
import { DIE_A_LOCK_MS, DIE_B_LOCK_MS } from "@monopoly-sol/shared";

interface Props {
  /** `drawResult.at` for the round in flight; `null` when there's nothing
   * to choreograph (idle/open/locked phases). */
  drawResultAt: number | null;
  walk: { startTile: number; steps: number } | null;
  landedTile: number | null;
}

/** Minimal shape this rig actually uses off `OrbitControls` -- typed
 * locally since r3f's `RootState.controls` is a bare `EventDispatcher`. */
interface ControlsLike {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
}

const CHASE_RATE = 2.4; // higher = snappier chase toward the desired pose
// Beat-RELATIVE, matching the units of `DrawBeatState.tBeat` that
// `desiredPose` compares them against. These were previously offset by
// BEAT_SETTLE_AT_MS, i.e. absolute timeline positions, which put them ~5s
// away from any value tBeat can take (0..BEAT_SETTLE_MS) -- so the die-lock
// camera shake could never fire and Beat 3 landed with no impact at all.
const LOCK_A_MS = DIE_A_LOCK_MS;
const LOCK_B_MS = DIE_B_LOCK_MS;
/** How long the camera is allowed to spend easing back to its resting pose
 * once the sequence ends, before control is handed back regardless. A cap is
 * needed because the damped chase approaches the target asymptotically. */
const HOME_MAX_MS = 1400;
/** Close enough to the resting pose to stop, in world units. */
const HOME_EPSILON = 0.15;

/**
 * Full cinematic camera rig for the draw sequence. Chases a per-beat
 * "desired pose" (`cameraKeyframes.ts`) every frame with a damped lerp --
 * no keyframe/tween library, smooth across beat boundaries for free, robust
 * to variable frame rate.
 *
 * Safety contract: this takes over `OrbitControls` input for the sequence
 * and MUST hand it back cleanly. Four independent triggers restore control:
 * (1) the sequence reaching "done", (2) unmount, (3) `drawResultAt` changing
 * mid-flight (a new round), and (4) the user directly touching the canvas
 * (pointerdown/wheel) -- an explicit escape hatch so an impatient player is
 * never fought for the camera. A try/catch around the per-frame work also
 * restores control defensively on any unexpected error rather than leaving
 * `controls.enabled` stuck at `false`.
 */
export function CinematicCamera({ drawResultAt, walk, landedTile }: Props) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const gl = useThree((s) => s.gl);

  const active = useRef(false);
  const cancelled = useRef(false);
  const shakeClock = useRef(0);
  const homingMs = useRef(0);
  const preludePos = useRef(new THREE.Vector3());
  const preludeTarget = useRef(new THREE.Vector3());

  // Escape hatch: any direct user interaction with the canvas aborts the
  // cinematic and hands control back on the next frame.
  useEffect(() => {
    const dom = gl.domElement;
    const abort = () => {
      if (active.current) cancelled.current = true;
    };
    dom.addEventListener("pointerdown", abort);
    dom.addEventListener("wheel", abort, { passive: true });
    return () => {
      dom.removeEventListener("pointerdown", abort);
      dom.removeEventListener("wheel", abort);
    };
  }, [gl]);

  // Unmount, or `drawResultAt` changing (a new round arriving mid-flight):
  // restore control synchronously rather than waiting for the next frame.
  useEffect(() => {
    return () => {
      if (active.current && controls) {
        controls.enabled = true;
        active.current = false;
      }
    };
  }, [drawResultAt, controls]);

  useFrame((_, dt) => {
    if (!controls) return;
    try {
      const beat = computeDrawBeat(Date.now(), drawResultAt, walk?.steps ?? 0);
      const inSequence = drawResultAt != null && beat.beat !== "idle" && beat.beat !== "done";

      if (inSequence && !active.current && !cancelled.current) {
        active.current = true;
        controls.enabled = false;
        homingMs.current = 0;
        preludePos.current.copy(camera.position);
        preludeTarget.current.copy(controls.target);
      }

      if (!inSequence || cancelled.current) {
        if (active.current) {
          // The user grabbed the camera: hand it straight back, wherever it is.
          // Fighting them to finish a move is worse than an abrupt cut.
          if (cancelled.current) {
            controls.enabled = true;
            active.current = false;
          } else {
            // The sequence ended. The final beat eases toward the resting pose,
            // but the damped chase always lags it -- so at "done" the camera is
            // still short of home, and simply restoring control here strands the
            // player on the celebration's close-up with the board cropped and
            // half the guess pads off screen. Keep flying until it arrives.
            homingMs.current += dt * 1000;
            const k = 1 - Math.pow(0.001, dt * CHASE_RATE);
            camera.position.lerp(preludePos.current, k);
            controls.target.lerp(preludeTarget.current, k);
            controls.update();
            const arrived =
              camera.position.distanceTo(preludePos.current) < HOME_EPSILON &&
              controls.target.distanceTo(preludeTarget.current) < HOME_EPSILON;
            if (arrived || homingMs.current > HOME_MAX_MS) {
              camera.position.copy(preludePos.current);
              controls.target.copy(preludeTarget.current);
              controls.update();
              controls.enabled = true;
              active.current = false;
            }
            return;
          }
        }
        if (!inSequence) cancelled.current = false; // rearm for the next round
        return;
      }

      const { pos, target, shake } = desiredPose(
        beat,
        walk,
        landedTile,
        { pos: preludePos.current, target: preludeTarget.current },
        LOCK_A_MS,
        LOCK_B_MS,
      );
      const k = 1 - Math.pow(0.001, dt * CHASE_RATE);
      camera.position.lerp(pos, k);
      controls.target.lerp(target, k);

      if (shake > 0) {
        shakeClock.current += dt * 41;
        camera.position.x += Math.sin(shakeClock.current * 13.1) * shake;
        camera.position.y += Math.sin(shakeClock.current * 17.7 + 1) * shake * 0.6;
      }

      controls.update();
    } catch (err) {
      console.error("[CinematicCamera] recovering from error, restoring control:", err);
      controls.enabled = true;
      active.current = false;
    }
  });

  return null;
}
