import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

const NUM_TILES = 40;
const PRIZE = LAMPORTS_PER_SOL / 2;
const DURATION = 8;

/**
 * `withdraw_treasury`: the vault's only exit that is not a prize.
 *
 * Every test here restores the balance it moved before finishing. The suites
 * share one treasury and run in the order `Anchor.toml` lists them, so a test
 * that quietly drained the vault would surface as `InsufficientTreasury` in
 * whichever suite happened to run next -- an error pointing at innocent code.
 */
describe("monopoly: treasury withdrawal", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.monopoly as Program<Monopoly>;
  const pid = program.programId;
  const authority = provider.wallet;
  const config = h.configPda(pid);
  const treasury = h.treasuryPda(pid);

  before(async () => {
    await h.ensureInitialized(program, authority, PRIZE, NUM_TILES, DURATION);
    await program.methods
      .fundTreasury(new anchor.BN(2 * LAMPORTS_PER_SOL))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
  });

  const balanceOf = (k: anchor.web3.PublicKey) => provider.connection.getBalance(k);

  it("sends a withdrawal to the nominated destination", async () => {
    const destination = Keypair.generate().publicKey;
    const amount = 0.25 * LAMPORTS_PER_SOL;
    const treasuryBefore = await balanceOf(treasury);

    await program.methods
      .withdrawTreasury(new anchor.BN(amount))
      .accounts({ authority: authority.publicKey, config, treasury, destination })
      .rpc();

    assert.equal(await balanceOf(destination), amount, "destination should receive the amount");
    assert.equal(
      await balanceOf(treasury),
      treasuryBefore - amount,
      "treasury should drop by exactly the amount"
    );

    // Put it back so later suites still have a funded pot.
    await program.methods
      .fundTreasury(new anchor.BN(amount))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
  });

  it("rejects a withdrawal by anyone other than the authority", async () => {
    const stranger = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(stranger.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");

    const treasuryBefore = await balanceOf(treasury);
    let msg = "";
    try {
      await program.methods
        .withdrawTreasury(new anchor.BN(0.1 * LAMPORTS_PER_SOL))
        .accounts({
          authority: stranger.publicKey,
          config,
          treasury,
          destination: stranger.publicKey,
        })
        .signers([stranger])
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }

    assert.match(msg, /Unauthorized/, "a stranger must not be able to drain the vault");
    assert.equal(await balanceOf(treasury), treasuryBefore, "treasury must be untouched");
  });

  it("refuses to withdraw more than is available above the rent floor", async () => {
    const treasuryBefore = await balanceOf(treasury);
    let msg = "";
    try {
      await program.methods
        // The whole balance, which necessarily eats into the rent-exempt
        // minimum the account must retain to survive.
        .withdrawTreasury(new anchor.BN(treasuryBefore))
        .accounts({
          authority: authority.publicKey,
          config,
          treasury,
          destination: Keypair.generate().publicKey,
        })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }

    assert.match(msg, /InsufficientTreasury/, "must leave the rent floor behind");
    assert.equal(await balanceOf(treasury), treasuryBefore, "treasury must be untouched");
  });

  it("treats amount 0 as 'everything above the rent floor'", async () => {
    const destination = Keypair.generate().publicKey;
    const treasuryBefore = await balanceOf(treasury);

    await program.methods
      .withdrawTreasury(new anchor.BN(0))
      .accounts({ authority: authority.publicKey, config, treasury, destination })
      .rpc();

    const treasuryAfter = await balanceOf(treasury);
    const swept = await balanceOf(destination);

    assert.isAbove(swept, 0, "destination should receive the sweepable balance");
    assert.equal(swept, treasuryBefore - treasuryAfter, "every swept lamport is accounted for");
    assert.isAbove(treasuryAfter, 0, "the rent floor stays behind so the account survives");

    // Restore, or the suites after this one open rounds against an empty pot.
    await program.methods
      .fundTreasury(new anchor.BN(swept))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
  });
});
