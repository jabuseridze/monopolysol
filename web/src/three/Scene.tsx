"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, SoftShadows } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BEAT_WALK_AT_MS, walkDurationMs } from "@monopoly-sol/shared";
import { Avatar } from "./Avatar";
import { Board } from "./Board";
import { CinematicCamera } from "./CinematicCamera";
import { CoinBurst } from "./CoinBurst";
import { Dice } from "./Dice";
import { Figurines } from "./Figurines";
import { GuessPads } from "./GuessPads";
import { Hologram } from "./Hologram";
import { Shockwave } from "./Shockwave";
import { SumFlare } from "./SumFlare";
import { TileRipple } from "./TileRipple";
import { World } from "./World";
import { BOARD_SIDE, TILE_HEIGHT, placeTile } from "./boardMath";
import { PALETTE } from "./palette";
import { BoardView } from "./viewTypes";

/**
 * Guess pads stay mounted through the draw so the winning pad's gold flare
 * is actually visible. They used to be hidden for `drawing`/`settled`, but
 * `winningSum` only becomes non-null once the draw lands -- so the entire
 * winner state was rendered `visible={false}` and never once appeared on
 * screen. They're hidden only before a round exists.
 */
function padsVisible(phase: BoardView["phase"]): boolean {
  return phase !== "idle";
}

export function Scene({ view }: { view: BoardView }) {
  // Every choreography timestamp derives from the one master clock, so the
  // camera, dice, avatar and effects can't drift apart.
  const at = view.drawResultAt;
  const steps = view.walk?.steps ?? 0;
  const landedAt = at != null ? at + BEAT_WALK_AT_MS + walkDurationMs(steps) : null;
  const landedPos = view.landedTile != null ? placeTile(view.landedTile) : null;

  // The coordinator advances `avatarTile` to the LANDING tile the instant it
  // emits the draw (roundPhases.ts sets `avatarTile: round.landedTile`), so
  // anchoring the pads to it makes the whole 11-pad window slide onto the
  // destination while the dice are still in the air -- silently giving the
  // answer away before the roll resolves. Anchor to where the avatar started
  // instead: those are the options players actually bet on this round, and
  // the winner among them is what flips gold at the landing.
  const padAnchorTile = view.walk ? view.walk.startTile : view.avatarTile;

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
          avatarTile={padAnchorTile}
          guessCounts={view.guessCounts}
          selectedSum={view.selectedSum}
          winningSum={view.winningSum}
          revealAt={landedAt}
          disabled={view.disabled}
          onGuess={view.onGuess}
        />
      </group>

      <Suspense fallback={null}>
        {/* Starts at lock rather than at the draw, so the crowd is already
            clear of the middle by the time the dice come down. */}
        <Figurines count={5} clearCenter={view.phase === "locked" || at != null} />
        <Avatar
          avatarTile={view.avatarTile}
          walk={view.walk}
          drawResultAt={at}
          landedTile={view.landedTile}
        />
      </Suspense>

      {/* Dice roll at the board's centre -- that airspace is empty, the
          MONOPOLY wordmark under it is painted into the board texture. */}
      <Dice dice={view.dice} drawResultAt={at} />
      <SumFlare sum={view.winningSum} triggerAt={at} />

      <Hologram phase={view.phase} landedTile={view.landedTile} landedAt={landedAt} />
      {landedPos && (
        <>
          <Shockwave
            triggerAt={landedAt}
            position={[landedPos.x, TILE_HEIGHT + 0.02, landedPos.z]}
            color="#f5d90a"
            maxRadius={BOARD_SIDE * 0.75}
            durationMs={1200}
          />
          <CoinBurst
            triggerAt={landedAt}
            position={[landedPos.x, TILE_HEIGHT + 0.3, landedPos.z]}
            count={view.youWon ? 36 : 24}
          />
        </>
      )}
      <TileRipple centerTile={view.landedTile} triggerAt={landedAt} />

      <CinematicCamera drawResultAt={at} walk={view.walk} landedTile={view.landedTile} />

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
        {/* Darkens the frame edges during the draw so the eye is pulled to
            the centre. Replaces the old cloud layer as the anticipation cue --
            those were lone faceted spheres larger than the avatar and read as
            glitching artifacts rather than weather. SMAA stays last. */}
        <Vignette offset={0.28} darkness={0.62} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
