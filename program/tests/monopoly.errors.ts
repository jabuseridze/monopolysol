import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

/**
 * These tests assume `monopoly.ts` already ran initialize (config exists) since
 * mocha runs files in the same validator session. Round ids continue from there.
 */
describe("monopoly: rejections", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.monopoly as Program<Monopoly>;
  const pid = program.programId;
  const authority = provider.wallet;
  const config = h.configPda(pid);

  async function airdrop(kp: Keypair, sol = 2) {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  it("rejects a second pick by the same wallet", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const seed = h.randomSeed();

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, round, systemProgram: SystemProgram.programId })
      .rpc();

    const alice = Keypair.generate();
    await airdrop(alice);
    const pick = h.pickPda(pid, roundId, alice.publicKey);
    const base = {
      player: alice.publicKey,
      config,
      round,
      pick,
      systemProgram: SystemProgram.programId,
    };

    await program.methods.pickTile(3).accounts(base).signers([alice]).rpc();

    let threw = false;
    try {
      await program.methods.pickTile(5).accounts(base).signers([alice]).rpc();
    } catch {
      threw = true; // account already initialized
    }
    assert.isTrue(threw, "second pick should fail");
  });

  it("rejects a reveal whose seed does not match the commit", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const seed = h.randomSeed();

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, round, systemProgram: SystemProgram.programId })
      .rpc();

    await h.sleep(2500);

    let msg = "";
    try {
      await program.methods
        .revealAndDraw(Array.from(h.randomSeed())) // wrong seed
        .accounts({ authority: authority.publicKey, config, round })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /BadReveal/, "wrong seed should be rejected");
  });
});
