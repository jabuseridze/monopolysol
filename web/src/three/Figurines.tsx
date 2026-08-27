"use client";

import { useMemo } from "react";
import { Character } from "./Character";
import { WANDERER_MODELS } from "./assets";

interface Props {
  count?: number;
  /** Passed through so the crowd vacates the board's centre while the dice
   * are landing there. */
  clearCenter?: boolean;
}

/**
 * Spawns KayKit adventurers running around the center track.
 *
 * Defaults to two. Raising this past `WANDERER_MODELS.length` starts reusing
 * models, and a crowd of repeated figures reads as a rendering glitch rather
 * than as a crowd -- add models to `assets.ts` instead, remembering that each
 * one is ~3.4 MB fetched on page load.
 */
export function Figurines({ count = 2, clearCenter = false }: Props) {
  const chars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        url: WANDERER_MODELS[i % WANDERER_MODELS.length],
        speed: 1.05 + (i % 3) * 0.25,
        seed: i * 137.13 + 7,
        // KayKit models are taller than Quaternius; keep them board-cute.
        scale: 0.55 + (i % 3) * 0.04,
      })),
    [count]
  );

  return (
    <group>
      {chars.map((c, i) => (
        <Character
          key={i}
          url={c.url}
          speed={c.speed}
          seed={c.seed}
          scale={c.scale}
          clearCenter={clearCenter}
        />
      ))}
    </group>
  );
}
