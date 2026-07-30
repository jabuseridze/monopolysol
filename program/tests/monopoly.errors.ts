import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

const NUM_TILES = 40;
const PRIZE = LAMPORTS_PER_SOL / 2; // 0.5 SOL
const DURATION = 8; // short for tests, but long enough for two sequential airdrop+confirm round-trips

/**
 * Round ids continue from whatever config.currentRound already is when each
 * test runs -- mocha globs tests/**\/*.ts and sorts alphabetically, so this
 * file actually runs BEFORE monopoly.ts, not after. ensureInitialized() in
 * before() makes this file work whichever order mocha picks. This file's
 * before() also funds the treasury -- being first, its own open_round calls
 * are the very first to hit the InsufficientTreasury check, and the treasury
 * starts with only its rent-exempt minimum right after `initialize`.
 */
describe("monopoly: rejections", () => {
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

  async function airdrop(kp: Keypair, sol = 2) {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  it("initializes with the avatar at tile 0 and the next prize armed to base", async () => {
    // This is the FIRST test to run anywhere in the suite (mocha sorts this
    // file before monopoly.ts), executing right after the one-time
    // `initialize` call in before() and before anything else has ever
    // touched the avatar -- the only point at which asserting an absolute
    // avatar position is safe. Every other test in either file must use the
    // after === (before + sum) % numTiles rule instead, since avatar state
    // is shared and mutable across the whole suite.
    const cfg = await program.account.globalConfig.fetch(config);
    assert.equal(cfg.avatarPosition, 0);
    assert.equal(cfg.nextPrizeLamports.toNumber(), cfg.prizeLamports.toNumber());
  });

  it("rejects a second pick by the same wallet", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const seed = h.randomSeed();

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
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

    await program.methods.submitGuess(3).accounts(base).signers([alice]).rpc();

    let threw = false;
    try {
      await program.methods.submitGuess(5).accounts(base).signers([alice]).rpc();
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
      .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
      .rpc();

    await h.sleep(DURATION * 1000 + 500);

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

  it("rejects submit_guess outside the valid dice-sum range", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const seed = h.randomSeed();

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
      .rpc();

    const player = Keypair.generate();
    await airdrop(player);
    const base = {
      player: player.publicKey,
      config,
      round,
      pick: h.pickPda(pid, roundId, player.publicKey),
      systemProgram: SystemProgram.programId,
    };

    for (const guess of [1, 13]) {
      let msg = "";
      try {
        await program.methods.submitGuess(guess).accounts(base).signers([player]).rpc();
      } catch (e: any) {
        msg = e.toString();
      }
      assert.match(msg, /InvalidGuess/, `guess ${guess} should be rejected`);
    }
  });

  it("rejects a second reveal_and_draw on the same round (avatar cannot double-advance)", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const seed = h.randomSeed();

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
      .rpc();

    await h.sleep(DURATION * 1000 + 500);

    await program.methods
      .revealAndDraw(Array.from(seed))
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();

    let msg = "";
    try {
      await program.methods
        .revealAndDraw(Array.from(seed))
        .accounts({ authority: authority.publicKey, config, round })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /RoundNotOpen/, "a second reveal on the same round must be rejected");
  });

  it("rejects payout for a pick whose guess doesn't match the drawn sum", async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    const sum = 6;
    const seed = h.findSeedForDiceSum(roundId, sum);
    const wrongGuess = sum === 12 ? 2 : sum + 1;

    await program.methods
      .openRound(h.commitOf(seed))
      .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
      .rpc();

    const loser = Keypair.generate();
    await airdrop(loser);
    await program.methods
      .submitGuess(wrongGuess)
      .accounts({
        player: loser.publicKey,
        config,
        round,
        pick: h.pickPda(pid, roundId, loser.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([loser])
      .rpc();

    await h.sleep(DURATION * 1000 + 500);
    await program.methods
      .revealAndDraw(Array.from(seed))
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();

    // Authority-asserted winner count -- nobody actually guessed `sum` here,
    // but settle() trusts the authority's count, so this reaches the guess
    // check inside payout() rather than failing earlier on NoWinners.
    await program.methods
      .settle(1)
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();

    let msg = "";
    try {
      await program.methods
        .payout()
        .accounts({
          authority: authority.publicKey,
          config,
          round,
          treasury,
          pick: h.pickPda(pid, roundId, loser.publicKey),
          winner: loser.publicKey,
        })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /NotAWinner/, "a non-matching guess must not be paid");
  });
});
