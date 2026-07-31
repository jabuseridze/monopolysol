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
  /** Epoch ms the coordinator revealed this round's dice. The master clock
   * for the whole draw choreography -- every beat offset in
   * `shared/src/constants.ts` is measured from here. Null outside a draw. */
  drawResultAt: number | null;
  /** Present only once this round's draw has happened: drives the avatar's
   * walk from `startTile` by `steps` tiles. Timing comes from
   * `drawResultAt` + the shared beat constants, not a separate stamp. */
  walk: { startTile: number; steps: number } | null;
  /** The committed dice faces, once revealed. */
  dice: { a: number; b: number } | null;
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
  /** True once the local wallet is known to be among this round's winners.
   * The 3D scene had no knowledge of who won at all before this -- the
   * celebration beat needs it to know whether to play the extra flourish. */
  youWon: boolean;
  onGuess: (sum: number) => void;
}
