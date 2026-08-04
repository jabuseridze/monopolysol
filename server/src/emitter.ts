import { RoundStateDTO } from "@monopoly-sol/shared";

/**
 * Socket.IO broadcast surface the round loop drives. Field names here match
 * `shared/src/types.ts`'s current DTOs post-Task-5 (`landedTile`,
 * `guessCounts`, dice-walk fields on `drawResult`).
 */
export interface Emitter {
  state: (s: RoundStateDTO) => void;
  tick: (
    roundId: number,
    secondsLeft: number,
    locksAtWall: number,
    phase: RoundStateDTO["phase"]
  ) => void;
  drawCue: (roundId: number, leadSeconds: number) => void;
  drawResult: (
    roundId: number,
    diceA: number,
    diceB: number,
    startTile: number,
    landedTile: number,
    seedHex: string,
    commitHex: string
  ) => void;
  settled: (
    roundId: number,
    landedTile: number,
    winners: string[],
    prize: number,
    share: number,
    sig: string | null
  ) => void;
}
