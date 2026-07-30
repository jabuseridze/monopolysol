import { RoundPhase } from "@monopoly-sol/shared";

/**
 * Plain, context-free data passed from <GameCanvas> into the R3F scene.
 * R3F uses a separate reconciler, so we bridge state via props rather than
 * React context.
 */
export interface BoardView {
  phase: RoundPhase;
  /** guessSum (2-12) -> backer count. TODO(Task 7): `Board`/`Tile` currently
   * index this by tile.index, which no longer matches under the dice-walk
   * mechanic -- see `GameCanvas.tsx`. */
  guessCounts: Record<number, number>;
  /** The local player's currently selected tile (null if none). */
  selected: number | null;
  /** Tile the avatar landed on once drawn (null while picking). */
  landedTile: number | null;
  /** Timestamp when the draw result arrived, to start the hologram. */
  drawResultAt: number | null;
  /** Whether the cloud layer should be visible. */
  cloudsActive: boolean;
  onPick: (tileIndex: number) => void;
}
