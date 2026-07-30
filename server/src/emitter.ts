import { RoundStateDTO } from "@monopoly-sol/shared";

/**
 * Socket.IO broadcast surface the round loop drives. Field names here still
 * say "winningTile" / "pickCounts" to match `shared/src/types.ts`'s current
 * DTOs -- Task 5 owns renaming those (winningTile -> landedTile, pickCounts
 * -> guessCounts) and wiring the socket generics. Don't rename here in
 * isolation; it'd leave Task 5's rename half-done.
 */
export interface Emitter {
  state: (s: RoundStateDTO) => void;
  tick: (roundId: number, secondsLeft: number, phase: RoundStateDTO["phase"]) => void;
  drawCue: (roundId: number, leadSeconds: number) => void;
  drawResult: (roundId: number, winningTile: number, seedHex: string, commitHex: string) => void;
  settled: (
    roundId: number,
    winningTile: number,
    winners: string[],
    prize: number,
    share: number,
    sig: string | null
  ) => void;
}
