import { useGLTF } from "@react-three/drei";

/** CC0 KayKit Adventurers — https://kaylousberg.itch.io/kaykit-adventurers */
export const CHARACTER_MODELS = [
  "/models/Barbarian.glb",
  "/models/Knight.glb",
  "/models/Mage.glb",
  "/models/Rogue.glb",
  "/models/Rogue_Hooded.glb",
];

/** KayKit locomotion clip used while wandering the center track. */
export const RUN_CLIP = "Running_A";

for (const url of CHARACTER_MODELS) useGLTF.preload(url);
