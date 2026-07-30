import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { AppConfig } from "./config.js";
import { bs58le } from "./bs58.js";
import { configPda, pickPda, roundPda, treasuryPda } from "./pdas.js";
import {
  decodeConfig,
  decodePickGuess,
  decodePickPlayer,
  decodeRound,
  ixDiscriminator,
  PICK_OFFSETS,
  RoundData,
} from "./anchorCodec.js";

const key = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

export class Chain {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly authority: Keypair;

  constructor(cfg: AppConfig) {
    this.connection = new Connection(cfg.rpcUrl, "confirmed");
    this.programId = cfg.programId;
    this.authority = cfg.authority;
  }

  private async send(ix: TransactionInstruction): Promise<string> {
    const tx = new Transaction().add(ix);
    tx.feePayer = this.authority.publicKey;
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(this.authority);
    const sig = await this.connection.sendRawTransaction(tx.serialize());
    await this.connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  async getConfig() {
    const info = await this.connection.getAccountInfo(configPda(this.programId));
    return info ? decodeConfig(info.data) : null;
  }

  async getRound(roundId: number | bigint): Promise<RoundData | null> {
    const info = await this.connection.getAccountInfo(roundPda(this.programId, roundId));
    return info ? decodeRound(info.data) : null;
  }

  /** Return { guessSum -> count } and the winners for a given guess sum (2-12). */
  async getPicks(roundId: number | bigint) {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        // 8 disc + player(32) + round_id(8) + guess(2) + claimed(1) + bump(1)
        { dataSize: 52 },
        { memcmp: { offset: PICK_OFFSETS.roundId, bytes: bs58le(roundId) } },
      ],
    });
    const counts: Record<number, number> = {};
    const byGuess: Record<number, PublicKey[]> = {};
    for (const { account } of accounts) {
      const guess = decodePickGuess(account.data);
      const player = new PublicKey(decodePickPlayer(account.data));
      counts[guess] = (counts[guess] ?? 0) + 1;
      (byGuess[guess] ??= []).push(player);
    }
    return { counts, byGuess };
  }

  /** Treasury vault balance in lamports (used by the refill CLI's threshold check). */
  async getTreasuryBalance(): Promise<number> {
    const info = await this.connection.getAccountInfo(treasuryPda(this.programId));
    return info?.lamports ?? 0;
  }

  /** `nextRoundId` must equal on-chain current_round + 1 (the seed the program derives). */
  openRound(nextRoundId: number | bigint, commitHash: number[]) {
    const data = Buffer.concat([ixDiscriminator("open_round"), Buffer.from(commitHash)]);
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, true),
        key(configPda(this.programId), false, true),
        key(treasuryPda(this.programId), false, false),
        key(roundPda(this.programId, nextRoundId), false, true),
        key(SystemProgram.programId, false, false),
      ],
      data,
    }));
  }

  revealAndDraw(roundId: number | bigint, seed: Buffer) {
    const data = Buffer.concat([ixDiscriminator("reveal_and_draw"), seed]);
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, false),
        // `config` is mut: reveal writes avatar_position + next_prize_lamports
        // (Task 2's Rust `#[account(mut, ...)]` on RevealAndDraw::config).
        key(configPda(this.programId), false, true),
        key(roundPda(this.programId, roundId), false, true),
      ],
      data,
    }));
  }

  settle(roundId: number | bigint, winnersCount: number) {
    const count = Buffer.alloc(4);
    count.writeUInt32LE(winnersCount);
    const data = Buffer.concat([ixDiscriminator("settle"), count]);
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, false),
        key(configPda(this.programId), false, true),
        key(roundPda(this.programId, roundId), false, true),
      ],
      data,
    }));
  }

  payout(roundId: number | bigint, winner: PublicKey) {
    const data = ixDiscriminator("payout");
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, false),
        key(configPda(this.programId), false, false),
        key(roundPda(this.programId, roundId), false, false),
        key(treasuryPda(this.programId), false, true),
        key(pickPda(this.programId, roundId, winner), false, true),
        key(winner, false, true),
      ],
      data,
    }));
  }
}
