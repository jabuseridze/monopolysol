import { useGLTF } from "@react-three/drei";

/** CC0 KayKit Adventurers — https://kaylousberg.itch.io/kaykit-adventurers */

/** The shared round avatar. Placeholder; swap this one constant for a bespoke
 * asset later. Re-exported by `Avatar.tsx`, which owns how it is rendered. */
export const AVATAR_MODEL = "/models/Knight.glb";

/**
 * The center-field wanderers.
 *
 * Two, not five, and deliberately not the Knight. This list used to hold all
 * five models in `public/models/`, every one of them preloaded on page load --
 * 17.2 MB of GLB before the board could be interacted with, for background
 * decoration. Trimming it to two distinct silhouettes drops that to 10.2 MB
 * and stops a crowd of near-identical figures competing with the avatar the
 * player is meant to be watching.
 *
 * The other three GLBs are still in `public/models/` and can be swapped in
 * here; they are simply no longer downloaded by default.
 */
export const WANDERER_MODELS = ["/models/Mage.glb", "/models/Rogue_Hooded.glb"];

/** KayKit locomotion clip used while wandering the center track. */
export const RUN_CLIP = "Running_A";

// Only what is actually rendered. `useGLTF.preload` is eager and unconditional,
// so anything listed here is fetched whether or not a component asks for it.
for (const url of [AVATAR_MODEL, ...WANDERER_MODELS]) useGLTF.preload(url);
