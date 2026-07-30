"use client";

import { useMemo } from "react";

const COLORS = ["#f5d90a", "#e03131", "#1971c2", "#2f9e44", "#e0559b", "#f08a24"];

/** Dependency-free confetti burst rendered as animated absolute divs. */
export function Confetti({ pieces = 80 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
      })),
    [pieces]
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 0.5,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            transform: `rotate(${b.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
