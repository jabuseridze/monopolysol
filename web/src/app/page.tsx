"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/Hud";

// The 3D scene is client-only (WebGL) - never server-rendered.
const GameCanvas = dynamic(
  () => import("@/three/GameCanvas").then((m) => m.GameCanvas),
  {
    ssr: false,
    loading: () => <div className="loading">Loading board...</div>,
  }
);

export default function Home() {
  return (
    <main id="app-root">
      <GameCanvas />
      <div className="overlay">
        <Hud />
      </div>
    </main>
  );
}
