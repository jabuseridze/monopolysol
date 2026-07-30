import { useMemo } from "react";
import * as THREE from "three";
import { ATLAS_PX } from "./atlasLayout";
import { drawBoardAtlas } from "./drawAtlas";

let cached: THREE.CanvasTexture | null = null;

/** Build (once) and return the shared board atlas as a CanvasTexture. */
export function useBoardTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_PX;
    canvas.height = ATLAS_PX;
    const ctx = canvas.getContext("2d");
    if (ctx) drawBoardAtlas(ctx);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false; // match atlas pixel space (v grows downward)
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    cached = tex;
    return tex;
  }, []);
}
