import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { associatedTokenAddress } from "./ata.js";

/**
 * The house wallet: sends prizes, and reads the token gate.
 *
 * This replaces the program's `payout` instruction, and the replacement is not
 * like-for-like. On-chain the destination was pinned to the pick's own player
 * and nobody -- including the operator -- could redirect a prize. Here the
 * destination is whatever this process passes in, so the address written when
 * the guess was accepted is the only record of who is owed. Never let a
 * caller-supplied address reach `payWinner`; read it back from `picks`.
 */
export class Wallet {
  readonly connection: Connection;

  constructor(
    rpcUrl: string,
    private readonly payer: Keypair,
    private readonly gateMint: PublicKey | null
  ) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  get address(): PublicKey {
    return this.payer.publicKey;
  }

  async balance(): Promise<number> {
    return this.connection.getBalance(this.payer.publicKey, "confirmed");
  }

  /** Send `lamports` to `winner`. Throws if the transfer does not confirm. */
  async payWinner(winner: string, lamports: number): Promise<string> {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: new PublicKey(winner),
        lamports,
      })
    );
    tx.feePayer = this.payer.publicKey;
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(this.payer);

    const sig = await this.connection.sendRawTransaction(tx.serialize());
    // Block on the height-aware form rather than the bare signature: the
    // caller marks the pick paid on return, so a "sent but never landed"
    // result here would record a payment that never happened.
    const res = await this.connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    if (res.value.err) {
      throw new Error(`transfer to ${winner} failed on chain: ${JSON.stringify(res.value.err)}`);
    }
    return sig;
  }

  /**
   * Does `player` hold the gate token? True when the gate is disabled.
   *
   * Reads the SPL token account directly -- this never needed our program, and
   * is why the gate survives moving off-chain unchanged. The balance is read
   * from the *pasted address's* associated account, so a holder cannot lend
   * their balance to a non-holder.
   */
  async holdsGateToken(player: string): Promise<boolean> {
    if (!this.gateMint) return true;
    const ata = associatedTokenAddress(new PublicKey(player), this.gateMint);
    try {
      const bal = await this.connection.getTokenAccountBalance(ata, "confirmed");
      return BigInt(bal.value.amount) > 0n;
    } catch {
      // No account for this mint at all -- the common case for a non-holder,
      // which the RPC reports as a missing account rather than a zero balance.
      return false;
    }
  }
}

export const solOf = (lamports: number): number => lamports / LAMPORTS_PER_SOL;
