import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { AppConfig } from "./config.js";
import { configPda, pickPda, roundPda, treasuryPda, u64le } from "./pdas.js";
import {
  decodeConfig,
  decodePickPlayer,
  decodePickTile,
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

  /** Return { tileIndex -> count } and the winners for a given tile. */
  async getPicks(roundId: number | bigint) {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        // 8 disc + player(32) + round_id(8) + tile_index(2) + claimed(1) + bump(1)
        { dataSize: 52 },
        { memcmp: { offset: PICK_OFFSETS.roundId, bytes: bs58le(roundId) } },
      ],
    });
    const counts: Record<number, number> = {};
    const byTile: Record<number, PublicKey[]> = {};
    for (const { account } of accounts) {
      const tile = decodePickTile(account.data);
      const player = new PublicKey(decodePickPlayer(account.data));
      counts[tile] = (counts[tile] ?? 0) + 1;
      (byTile[tile] ??= []).push(player);
    }
    return { counts, byTile };
  }

  /** `nextRoundId` must equal on-chain current_round + 1 (the seed the program derives). */
  openRound(nextRoundId: number | bigint, commitHash: number[]) {
    const data = Buffer.concat([ixDiscriminator("open_round"), Buffer.from(commitHash)]);
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, true),
        key(configPda(this.programId), false, true),
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
        key(configPda(this.programId), false, false),
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

/** base58 of a u64 little-endian value, for getProgramAccounts memcmp. */
function bs58le(n: number | bigint): string {
  // @solana/web3.js re-exports bs58 via PublicKey; encode manually.
  return bs58encode(u64le(n));
}

// Minimal base58 encoder (Bitcoin alphabet) to avoid an extra dependency.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bs58encode(buf: Buffer): string {
  let digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i]! << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let str = "";
  for (const b of buf) { if (b === 0) str += "1"; else break; }
  for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]!];
  return str;
}
