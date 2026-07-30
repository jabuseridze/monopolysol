import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

const NUM_TILES = 40;
const PRIZE = LAMPORTS_PER_SOL / 2; // 0.5 SOL
const DURATION = 2; // short for tests

describe("monopoly: happy path + split payout", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.monopoly as Program<Monopoly>;
  const pid = program.programId;
  const authority = provider.wallet;

  const config = h.configPda(pid);
  const treasury = h.treasuryPda(pid);

  async function airdrop(kp: Keypair, sol = 2) {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  it("initializes config + treasury", async () => {
    await program.methods
      .initialize(new anchor.BN(PRIZE), NUM_TILES, DURATION)
      .accounts({ authority: authority.publicKey, config, treasury, systemProgram: SystemProgram.programId })
      .rpc();
    const cfg = await program.account.globalConfig.fetch(config);
    assert.equal(cfg.numTiles, NUM_TILES);
    assert.equal(cfg.prizeLamports.toNumber(), PRIZE);
  });

  it("funds the treasury", async () => {
    await program.methods
      .fundTreasury(new anchor.BN(LAMPORTS_PER_SOL))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
    const bal = await provider.connection.getBalance(treasury);
    assert.isAtLeast(bal, LAMPORTS_PER_SOL);
  });

  it("runs a full round with two winners splitting the prize", async () => {
    const roundId = 1;
    const targetTile = 7;
    const seed = h.findSeedForTile(roundId, NUM_TILES, targetTile);
    const round = h.roundPda(pid, roundId);

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, round, systemProgram: SystemProgram.programId })
      .rpc();

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await airdrop(alice);
    await airdrop(bob);

    for (const player of [alice, bob]) {
      await program.methods
        .pickTile(targetTile)
        .accounts({
          player: player.publicKey,
          config,
          round,
          pick: h.pickPda(pid, roundId, player.publicKey),
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();
    }

    await h.sleep(DURATION * 1000 + 500);

    await program.methods
      .revealAndDraw(Array.from(seed))
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();
    const drawn = await program.account.round.fetch(round);
    assert.equal(drawn.winningTile, targetTile);

    await program.methods
      .settle(2)
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();

    const share = PRIZE / 2;
    for (const player of [alice, bob]) {
      const before = await provider.connection.getBalance(player.publicKey);
      await program.methods
        .payout()
        .accounts({
          authority: authority.publicKey,
          config,
          round,
          treasury,
          pick: h.pickPda(pid, roundId, player.publicKey),
          winner: player.publicKey,
        })
        .rpc();
      const after = await provider.connection.getBalance(player.publicKey);
      assert.equal(after - before, share, "winner received equal share");
    }
  });
});
