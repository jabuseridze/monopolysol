"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_SIDE } from "./boardMath";

/** Minimal shape this component uses off `OrbitControls`. */
interface ControlsLike {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

/** Breathing room around the board, as a fraction of the frame. */
const MARGIN = 1.06;
/** Vertical span the fit has to clear: the tiles, the guess pads floating
 * above them, and the avatar standing on top. Nothing else near the rim is
 * taller. */
const CONTENT_HEIGHT = 2.2;
const PASSES = 4;

/** Corners of the box the camera must frame -- the board's footprint plus
 * the headroom above it. */
const CORNERS: THREE.Vector3[] = [];
for (const x of [-BOARD_SIDE / 2, BOARD_SIDE / 2]) {
  for (const z of [-BOARD_SIDE / 2, BOARD_SIDE / 2]) {
    for (const y of [0, CONTENT_HEIGHT]) CORNERS.push(new THREE.Vector3(x, y, z));
  }
}

/**
 * Frames the whole board on screen, and re-frames whenever the window
 * changes shape.
 *
 * The camera used to sit at a hardcoded distance with a fixed 26-degree
 * vertical field of view, so its framing was only ever right at whatever
 * window size it was tuned at -- in practice the near corner and the lowest
 * guess pads were cut off at every size, glaringly so in fullscreen.
 *
 * Two things have to be solved together, which is why this iterates:
 *
 * - **Distance.** Fitting analytically is awkward: the board is a flat square
 *   seen obliquely, so its silhouette isn't a circle and its corners sit at
 *   very different depths. A bounding *sphere* would be correct but far too
 *   conservative, reserving room above and below the board plane where there
 *   is nothing to see. Projecting the eight box corners and scaling by the
 *   overflow converges in a couple of passes instead.
 *
 * - **Centring.** Aiming at the board's centre does NOT centre it on screen:
 *   under perspective the near corner projects much larger than the far one,
 *   so the silhouette sits low with dead space above it, and the fit then
 *   wastes distance pushing that near corner inside the frame. Panning the
 *   camera and its orbit target together along the screen axes recentres the
 *   silhouette without altering the viewing angle -- and once centred, the
 *   same distance frames the board noticeably larger.
 */
export function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  useEffect(() => {
    if (!camera.isPerspectiveCamera) return;

    // Keep whatever direction the camera currently looks from, so a resize
    // re-frames the shot without also undoing the player's orbit.
    const orbit = controls?.target ?? new THREE.Vector3();
    const dir = camera.position.clone().sub(orbit);
    if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.66, 0.6);
    dir.normalize();

    let distance = camera.position.distanceTo(orbit) || BOARD_SIDE * 1.6;
    // Always re-centre from the board's actual middle rather than from the
    // previous pan, so repeated resizes can't drift the framing.
    const target = new THREE.Vector3(0, 0, 0);
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const min = new THREE.Vector2();
    const max = new THREE.Vector2();

    camera.aspect = size.width / size.height;

    for (let pass = 0; pass < PASSES; pass++) {
      camera.position.copy(dir).multiplyScalar(distance).add(target);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      min.set(Infinity, Infinity);
      max.set(-Infinity, -Infinity);
      for (const corner of CORNERS) {
        const ndc = corner.clone().project(camera);
        min.min(new THREE.Vector2(ndc.x, ndc.y));
        max.max(new THREE.Vector2(ndc.x, ndc.y));
      }

      // Recentre: shift the target by the silhouette's offset from the middle
      // of the frame, converted from NDC into world units on the plane the
      // camera is focused on.
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
      const halfW = halfH * camera.aspect;
      camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      target
        .addScaledVector(right, ((min.x + max.x) / 2) * halfW)
        .addScaledVector(up, ((min.y + max.y) / 2) * halfH);

      const overflow = Math.max((max.x - min.x) / 2, (max.y - min.y) / 2);
      if (overflow > 0) distance *= overflow * MARGIN;
    }

    camera.position.copy(dir).multiplyScalar(distance).add(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    if (controls) {
      // The zoom limits have to bracket the fit distance, or OrbitControls
      // clamps the camera straight back to a cropped frame on its next update.
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.8;
      // Without this the rig keeps orbiting (and re-aiming) around the board's
      // centre, and its next `update()` silently undoes the recentring pan.
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, size.width, size.height]);

  return null;
}
