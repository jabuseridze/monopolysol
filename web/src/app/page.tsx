"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/Hud";
import { Landing } from "@/components/Landing";
import { useIdentity } from "@/hooks/useIdentity";

// The 3D scene is client-only (WebGL) - never server-rendered.
const GameCanvas = dynamic(
  () => import("@/three/GameCanvas").then((m) => m.GameCanvas),
  {
    ssr: false,
    loading: () => <div className="loading">Loading board...</div>,
  }
);

export default function Home() {
  const { ready, hydrated } = useIdentity();

  // Hold everything back for the one frame it takes to read the stored
  // address. Rendering the landing screen first would flash it at every
  // returning player, and rendering the board first would start a socket and a
  // WebGL context for someone who is about to be sent back to the door.
  if (!hydrated) return <div className="loading">Loading...</div>;

  // The board is mounted only once an address exists, so the whole game --
  // canvas, socket, audio -- starts at the moment the player commits, not
  // while they are still reading the front page.
  if (!ready) return <Landing />;

  return (
    <main id="app-root">
      <GameCanvas />
      <div className="overlay">
        <Hud />
      </div>
    </main>
  );
}
