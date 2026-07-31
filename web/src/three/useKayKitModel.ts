"use client";

import { useMemo } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

const HIDE_MESH_RE = /sword|shield|axe|bow|staff|wand|arrow|quiver|mug|book|bomb/i;

/**
 * Loads + clones a KayKit adventurer GLTF: `SkeletonUtils.cloneSkeleton`
 * (necessary because multiple instances share one cached GLTF), shadow-
 * casting setup, and hiding held-weapon meshes via name matching. Shared by
 * `Character.tsx` (center-field wanderers) and `Avatar.tsx` (the shared
 * round avatar) -- everything past this point (grounding height, animation
 * state machine, movement) differs enough between the two that forcing them
 * into one parameterized component isn't worth it.
 */
export function useKayKitModel(url: string) {
  const { scene, animations } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!(o as THREE.SkinnedMesh).isSkinnedMesh && HIDE_MESH_RE.test(mesh.name)) {
          mesh.visible = false;
        }
      }
    });
    return c;
  }, [scene]);

  // Bind clips to the CLONE (not the shared GLTF scene).
  const { actions, names } = useAnimations(animations, cloned);
  return { scene: cloned, actions, names };
}
