import { RoundPhase } from "@monopoly-sol/shared";

/**
 * Plain, context-free data passed from <GameCanvas> into the R3F scene.
 * R3F uses a separate reconciler, so we bridge state via props rather than
 * React context.
 */
export interface BoardView {
  phase: RoundPhase;
  /** Tile the avatar is currently resting on (or has landed on, once drawn). */
  avatarTile: number;
  /** Present only once this round's draw has happened: drives the avatar's
   * walk from `startTile` by `steps` tiles, timed off `at` (epoch ms). */
  walk: { startTile: number; steps: number; at: number } | null;
  /** Present only once this round's draw has happened: the committed dice
   * faces + when they were revealed, timed off `at` (epoch ms). */
  dice: { a: number; b: number; at: number } | null;
  /** Tile the avatar landed on once drawn (null while picking). */
  landedTile: number | null;
  /** guessSum (2-12) -> number of wallets currently backing it. */
  guessCounts: Record<number, number>;
  /** The local player's currently selected guess sum (null if none). */
  selectedSum: number | null;
  /** Guess sum matching the actual dice roll, once known (null until then). */
  winningSum: number | null;
  /** True once guessing has closed for this round. */
  disabled: boolean;
  /** Whether the cloud layer should be visible. */
  cloudsActive: boolean;
  onGuess: (sum: number) => void;
}
