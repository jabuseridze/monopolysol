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
        // + counted(1). Bumped from 52 when `tally` added the counted flag --
        // a stale value here returns zero picks with no error.
        { dataSize: 53 },
        { memcmp: { offset: PICK_OFFSETS.roundId, bytes: bs58le(roundId) } },
      ],
      // No `dataSlice`: the fields actually read (player at 8, guess at 48)
      // span all but the last two bytes of a 52-byte account, so slicing
      // would save nothing while invalidating `PICK_OFFSETS`, which are
      // absolute. The real cost of this call is the RPC node's scan over
      // every account the program has ever owned -- pick PDAs are never
      // closed, so that grows with total game history, not with the current
      // round. Fixing that needs an index, not a smaller payload.
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

  /** Count a batch of picks on-chain. Repeat until `tallied == total_picks`. */
  tally(roundId: number | bigint, players: PublicKey[]) {
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, false),
        key(configPda(this.programId), false, false),
        key(roundPda(this.programId, roundId), false, true),
        // Picks ride in `remaining_accounts`: writable (the instruction sets
        // their `counted` flag) and non-signing.
        ...players.map((p) => key(pickPda(this.programId, roundId, p), false, true)),
      ],
      data: ixDiscriminator("tally"),
    }));
  }

  /** Permissionless write-off for a round nobody ever revealed. */
  expireRound(roundId: number | bigint) {
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, false),
        key(roundPda(this.programId, roundId), false, true),
      ],
      data: ixDiscriminator("expire_round"),
    }));
  }

  /** Takes no winner count any more -- `tally` derives it on-chain. */
  settle(roundId: number | bigint) {
    const data = ixDiscriminator("settle");
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

  /**
   * Submit a guess on a player's behalf.
   *
   * The player pasted an address rather than connecting a wallet, so they
   * cannot sign and cannot fund the pick account -- the authority does both.
   * The chain still enforces the token gate against `player` (not against the
   * signer), so this cannot let a non-holder play.
   *
   * `playerTokenAccount` is the player's associated token account for the gate
   * mint, or the program id to mean "None" when the gate is disabled (Anchor's
   * optional-account convention, matching what the web client used to send).
   */
  submitGuess(
    roundId: number | bigint,
    player: PublicKey,
    guess: number,
    playerTokenAccount: PublicKey | null
  ) {
    const arg = Buffer.alloc(2);
    arg.writeUInt16LE(guess);
    const data = Buffer.concat([ixDiscriminator("submit_guess"), arg]);
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, true),
        key(player, false, false),
        key(configPda(this.programId), false, false),
        key(roundPda(this.programId, roundId), false, true),
        key(pickPda(this.programId, roundId, player), false, true),
        key(SystemProgram.programId, false, false),
        key(playerTokenAccount ?? this.programId, false, false),
      ],
      data,
    }));
  }

  /** Reclaim a settled pick's rent. Reverts on an unpaid winner. */
  closePick(roundId: number | bigint, player: PublicKey) {
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        key(this.authority.publicKey, true, true),
        key(configPda(this.programId), false, false),
        key(roundPda(this.programId, roundId), false, false),
        key(pickPda(this.programId, roundId, player), false, true),
      ],
      data: ixDiscriminator("close_pick"),
    }));
  }

  payout(roundId: number | bigint, winner: PublicKey) {
    const data = ixDiscriminator("payout");
    return this.send(new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Slot 0 is `payer`, not `authority` -- `payout` is permissionless
        // (see `payout.rs`). The coordinator signs here because it is paying
        // the fee, not because the program requires it; the same instruction
        // is built browser-side with the winner as payer for manual claims.
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
