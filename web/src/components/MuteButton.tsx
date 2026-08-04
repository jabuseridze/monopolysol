"use client";

import { useEffect, useState } from "react";
import { audio } from "@/lib/audio";

export function MuteButton() {
  // Must start at the *unmuted* default so the server-rendered icon matches
  // the client's first paint. `audio.muted` reads a localStorage preference,
  // which doesn't exist during SSR -- seeding state from it directly renders
  // a different glyph on each side and fails hydration for the whole page.
  const [muted, setMuted] = useState(false);

  // Adopt the stored preference once mounted, when localStorage is readable.
  useEffect(() => setMuted(audio.muted), []);

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
