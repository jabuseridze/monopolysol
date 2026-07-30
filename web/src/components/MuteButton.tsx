"use client";

import { useState } from "react";
import { audio } from "@/lib/audio";

export function MuteButton() {
  // Seeded from the audio manager rather than hardcoded, so the icon reflects
  // reality — audio currently defaults to muted (see lib/audio.ts).
  const [muted, setMuted] = useState(audio.muted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    if (!next) audio.unlock();
  };

  return (
    <button
      className="btn ghost"
      onClick={toggle}
      title={muted ? "Unmute" : "Mute"}
      style={{ position: "absolute", left: 16, top: 16, width: 44, height: 44, fontSize: 18, padding: 0 }}
    >
      {muted ? "\u{1F507}" : "\u{1F50A}"}
    </button>
  );
}
