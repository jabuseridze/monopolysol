import { RoundPhase } from "@monopoly-sol/shared";

/**
 * Plain, context-free data passed from <GameCanvas> into the R3F scene.
 * R3F uses a separate reconciler, so we bridge state via props rather than
 * React context.
 */
export interface BoardView {
  phase: RoundPhase;
  pickCounts: Record<number, number>;
  /** The local player's currently selected tile (null if none). */
  selected: number | null;
  /** Winning tile once drawn (null while picking). */
  winningTile: number | null;
  /** Timestamp when the draw result arrived, to start the hologram. */
  drawResultAt: number | null;
  /** Whether the cloud layer should be visible. */
  cloudsActive: boolean;
  onPick: (tileIndex: number) => void;
}
