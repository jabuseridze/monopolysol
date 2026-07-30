import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "./env";
import { configPda, pickPda, roundPda } from "./pdas";

// sha256("global:pick_tile")[..8], precomputed so we don't bundle a hasher.
const PICK_TILE_DISCRIMINATOR = new Uint8Array([228, 140, 53, 111, 167, 50, 67, 127]);

/** Build the `pick_tile(tile_index)` instruction for the connected wallet. */
export function buildPickTileIx(
  player: PublicKey,
  roundId: number,
  tileIndex: number
): TransactionInstruction {
  const data = new Uint8Array(10);
  data.set(PICK_TILE_DISCRIMINATOR, 0);
  new DataView(data.buffer).setUint16(8, tileIndex, true);

  const keys = [
    { pubkey: player, isSigner: true, isWritable: true },
    { pubkey: configPda(), isSigner: false, isWritable: false },
    { pubkey: roundPda(roundId), isSigner: false, isWritable: true },
    { pubkey: pickPda(roundId, player), isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data) });
}
