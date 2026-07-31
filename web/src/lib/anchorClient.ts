import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "./env";
import { configPda, pickPda, roundPda } from "./pdas";

// sha256("global:submit_guess")[..8], precomputed so we don't bundle a hasher.
const SUBMIT_GUESS_DISCRIMINATOR = new Uint8Array([61, 124, 32, 227, 64, 198, 252, 3]);

/** Build the `submit_guess(guess)` instruction for the connected wallet.
 * `guess` is the dice-sum guess (2-12); wire format is unchanged from the
 * old `pick_tile` instruction (10-byte payload, u16 at offset 8) -- only the
 * discriminator and the field name changed. */
export function buildSubmitGuessIx(
  player: PublicKey,
  roundId: number,
  guessSum: number
): TransactionInstruction {
  const data = new Uint8Array(10);
  data.set(SUBMIT_GUESS_DISCRIMINATOR, 0);
  new DataView(data.buffer).setUint16(8, guessSum, true);

  const keys = [
    { pubkey: player, isSigner: true, isWritable: true },
    { pubkey: configPda(), isSigner: false, isWritable: false },
    { pubkey: roundPda(roundId), isSigner: false, isWritable: true },
    { pubkey: pickPda(roundId, player), isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data) });
}
