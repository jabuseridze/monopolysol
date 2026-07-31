"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, SoftShadows } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { WALK_STEP_MS } from "@monopoly-sol/shared";
import { Avatar } from "./Avatar";
import { Board } from "./Board";
import { Dice } from "./Dice";
import { Figurines } from "./Figurines";
import { GuessPads } from "./GuessPads";
import { Hologram } from "./Hologram";
import { CloudLayer } from "./Clouds";
import { World } from "./World";
import { BOARD_SIDE, placeTile } from "./boardMath";
import { PALETTE } from "./palette";
import { BoardView } from "./viewTypes";

/** Guess pads only make sense while there's something to guess about --
 * hidden once the draw starts (the avatar/dice/hologram take over) or
 * before a round has opened. */
function padsVisible(phase: BoardView["phase"]): boolean {
  return phase === "open" || phase === "locked";
}

export function Scene({ view }: { view: BoardView }) {
  const landedAt = view.walk ? view.walk.at + view.walk.steps * WALK_STEP_MS : null;
  const diceOrigin = placeTile(view.walk?.startTile ?? view.avatarTile);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      camera={{ position: [BOARD_SIDE * 0.9, BOARD_SIDE * 1.0, BOARD_SIDE * 0.9], fov: 26 }}
    >
      <color attach="background" args={[PALETTE.sky]} />
      <SoftShadows size={26} samples={16} focus={0.9} />

      {/* Cool sky fill + warm key sun */}
      <hemisphereLight args={["#e8f4ff", PALETTE.groundDark, 0.55]} />
      <ambientLight intensity={0.22} color="#fff5e6" />
      <directionalLight
        position={[BOARD_SIDE * 0.55, BOARD_SIDE * 1.1, BOARD_SIDE * 0.3]}
        intensity={2.15}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-BOARD_SIDE}
        shadow-camera-right={BOARD_SIDE}
        shadow-camera-top={BOARD_SIDE}
        shadow-camera-bottom={-BOARD_SIDE}
      />

      <Environment resolution={256}>
        <Lightformer intensity={1.15} position={[0, 8, 4]} scale={[12, 12, 1]} color="#ffffff" />
        <Lightformer intensity={0.75} position={[-8, 4, -6]} scale={[8, 8, 1]} color="#cfe4ff" />
        <Lightformer intensity={0.7} position={[8, 3, 6]} scale={[8, 8, 1]} color="#ffe6c2" />
      </Environment>

      <World />
      <Suspense fallback={null}>
        <Board />
      </Suspense>

      <group visible={padsVisible(view.phase)}>
        <GuessPads
          avatarTile={view.avatarTile}
          guessCounts={view.guessCounts}
          selectedSum={view.selectedSum}
          winningSum={view.winningSum}
          disabled={view.disabled}
          onGuess={view.onGuess}
        />
      </group>

      <Suspense fallback={null}>
        <Figurines count={5} />
        <Avatar avatarTile={view.avatarTile} walk={view.walk} landedTile={view.landedTile} />
      </Suspense>
      <Dice dice={view.dice} origin={{ x: diceOrigin.x, z: diceOrigin.z }} />
      <Hologram phase={view.phase} landedTile={view.landedTile} landedAt={landedAt} />
      <CloudLayer active={view.cloudsActive} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        target={[0, 0, 0]}
        minDistance={BOARD_SIDE * 0.85}
        maxDistance={BOARD_SIDE * 2.2}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.4}
      />

      <EffectComposer multisampling={0}>
        <N8AO aoRadius={1.6} intensity={3.2} distanceFalloff={1.0} color="#1a1f2e" halfRes />
        <Bloom intensity={0.35} luminanceThreshold={0.9} luminanceSmoothing={0.15} mipmapBlur />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
