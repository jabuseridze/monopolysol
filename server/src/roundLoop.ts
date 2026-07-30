import {
  ALARM_LEAD_SEC,
  DRAW_SEQUENCE_SEC,
  RoundStateDTO,
} from "@monopoly-sol/shared";
import { Chain } from "./chain.js";
import { deriveWinningTile, makeRoundSecret, toHex } from "./seed.js";

export interface Emitter {
  state: (s: RoundStateDTO) => void;
  tick: (roundId: number, secondsLeft: number, phase: RoundStateDTO["phase"]) => void;
  drawCue: (roundId: number, leadSeconds: number) => void;
  drawResult: (roundId: number, winningTile: number, seedHex: string, commitHex: string) => void;
  settled: (roundId: number, winningTile: number, winners: string[], prize: number, share: number, sig: string | null) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RoundLoop {
  private snapshot: RoundStateDTO = emptySnapshot();

  constructor(private chain: Chain, private emit: Emitter) {}

  getSnapshot(): RoundStateDTO {
    return this.snapshot;
  }

  async run(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.runRound();
      } catch (err) {
        console.error("[roundLoop] round failed:", err);
        await sleep(5000);
      }
    }
  }

  private setState(patch: Partial<RoundStateDTO>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit.state(this.snapshot);
  }

  private async runRound(): Promise<void> {
    const cfg = await this.chain.getConfig();
    if (!cfg) {
      console.warn("[roundLoop] config not initialized; retrying...");
      await sleep(5000);
      return;
    }

    const roundId = Number(cfg.currentRound) + 1;
    const secret = makeRoundSecret();
    await this.chain.openRound(roundId, secret.commitHash);

    const round = await this.chain.getRound(roundId);
    if (!round) throw new Error("round account missing after open");
    const locksAtMs = Number(round.locksAt) * 1000;

    this.snapshot = {
      roundId,
      phase: "open",
      secondsLeft: Math.max(0, Math.ceil((locksAtMs - Date.now()) / 1000)),
      locksAt: locksAtMs,
      prizeLamports: Number(round.prizeLamports),
      numTiles: cfg.numTiles,
      pickCounts: {},
      commitHash: toHex(secret.commitHash),
      winningTile: null,
      revealedSeed: null,
      winners: [],
    };
    this.emit.state(this.snapshot);

    await this.pickingPhase(roundId, locksAtMs);
    await this.drawPhase(roundId, secret.seed, cfg.numTiles);
  }

  private async pickingPhase(roundId: number, locksAtMs: number): Promise<void> {
    let cuedAlarm = false;
    let lastRefresh = 0;
    while (Date.now() < locksAtMs) {
      const secondsLeft = Math.max(0, Math.ceil((locksAtMs - Date.now()) / 1000));
      this.snapshot.secondsLeft = secondsLeft;
      this.emit.tick(roundId, secondsLeft, "open");

      if (!cuedAlarm && secondsLeft <= ALARM_LEAD_SEC) {
        cuedAlarm = true;
        this.emit.drawCue(roundId, ALARM_LEAD_SEC);
      }
      if (Date.now() - lastRefresh > 4000) {
        lastRefresh = Date.now();
        const { counts } = await this.chain.getPicks(roundId);
        this.setState({ pickCounts: counts });
      }
      await sleep(1000);
    }
    this.setState({ phase: "locked", secondsLeft: 0 });
  }

  private async drawPhase(roundId: number, seed: Buffer, numTiles: number): Promise<void> {
    await this.chain.revealAndDraw(roundId, seed);
    const winningTile = deriveWinningTile(seed, roundId, numTiles);
    this.setState({ phase: "drawing", winningTile, revealedSeed: toHex(seed) });
    this.emit.drawResult(roundId, winningTile, toHex(seed), this.snapshot.commitHash ?? "");

    const { byTile } = await this.chain.getPicks(roundId);
    const winners = (byTile[winningTile] ?? []).map((p) => p.toBase58());
    await this.chain.settle(roundId, winners.length);

    const prize = this.snapshot.prizeLamports;
    const share = winners.length > 0 ? Math.floor(prize / winners.length) : 0;
    let lastSig: string | null = null;
    for (const w of byTile[winningTile] ?? []) {
      try {
        lastSig = await this.chain.payout(roundId, w);
      } catch (e) {
        console.error("[roundLoop] payout failed for", w.toBase58(), e);
      }
    }

    this.setState({ phase: "settled", winners });
    this.emit.settled(roundId, winningTile, winners, prize, share, lastSig);
    await sleep(DRAW_SEQUENCE_SEC * 1000);
  }
}

function emptySnapshot(): RoundStateDTO {
  return {
    roundId: 0,
    phase: "idle",
    secondsLeft: 0,
    locksAt: 0,
    prizeLamports: 0,
    numTiles: 40,
    pickCounts: {},
    commitHash: null,
    winningTile: null,
    revealedSeed: null,
    winners: [],
  };
}
