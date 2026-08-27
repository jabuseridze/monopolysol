import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";
import { landingFor, nextPrizeForLanding } from "@monopoly-sol/shared/effects";
import { airdrop, openRevealRound, reachablePumpSum, tallyAndSettle, RoundCtx } from "./roundOrchestration";

const NUM_TILES = 40;
const PRIZE = LAMPORTS_PER_SOL / 2; // 0.5 SOL
const DURATION = 8;

/**
 * Runs after monopoly.errors.ts and monopoly.ts (mocha sorts alphabetically:
 * "monopoly.errors.ts" < "monopoly.ts" < "monopoly.walk.ts"), so the avatar
 * position/treasury balance here are whatever those files left behind --
 * every test reads state fresh rather than assuming a starting point. The
 * solvency test at the end must stay last: it deliberately drains the
 * treasury toward zero.
 */
describe("monopoly: avatar walk + solvency", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.monopoly as Program<Monopoly>;
  const pid = program.programId;
  const authority = provider.wallet;

  const config = h.configPda(pid);
  const treasury = h.treasuryPda(pid);
  const ctx: RoundCtx = { program, pid, config, authority, duration: DURATION };

  before(async () => {
    await h.ensureInitialized(program, authority, PRIZE, NUM_TILES, DURATION);
  });

  it("walks the avatar across four rounds, wrapping past GO at least once", async () => {
    const cfgStart = await program.account.globalConfig.fetch(config);
    let pos = cfgStart.avatarPosition;
    // 4 * 12 = 48 > 40 -- guarantees at least one hop crosses GO regardless
    // of the starting position (each hop moves <= 12, so the cumulative
    // walk must cross a multiple of 40 somewhere in the sequence).
    const sums = [12, 12, 12, 12];
    let wrapped = false;

    for (const sum of sums) {
      const before = pos;
      const { round } = await openRevealRound(ctx, sum);
      const drawn = await program.account.round.fetch(round);
      const expected = (before + sum) % NUM_TILES;
      assert.equal(drawn.landedTile, expected);

      const cfgAfter = await program.account.globalConfig.fetch(config);
      assert.equal(cfgAfter.avatarPosition, expected);

      if (before + sum >= NUM_TILES) wrapped = true;
      pos = expected;
    }

    assert.isTrue(wrapped, "at least one round in the walk must cross GO");
  });

  it("degrades to the landed tile's own effect on a zero-winner round (no rollover)", async () => {
    const treasuryBefore = await provider.connection.getBalance(treasury);
    const cfgBefore = await program.account.globalConfig.fetch(config);
    const pos = cfgBefore.avatarPosition;
    const sum = 9; // nobody guesses this
    const { landedTile, passedOrLandedGo } = landingFor(pos, sum, NUM_TILES);
    const expectedNextPrize = nextPrizeForLanding({ landedTile, passedOrLandedGo });

    const guesser = Keypair.generate();
    await airdrop(provider, guesser);
    const wrongGuess = sum === 12 ? 2 : sum + 1;

    const { roundId, round } = await openRevealRound(ctx, sum, [{ kp: guesser, guess: wrongGuess }]);
    const drawn = await program.account.round.fetch(round);
    assert.equal(drawn.nextPrizeLamports.toNumber(), expectedNextPrize);

    await tallyAndSettle(ctx, roundId, round, [guesser.publicKey]);

    const cfgAfter = await program.account.globalConfig.fetch(config);
    assert.equal(
      cfgAfter.nextPrizeLamports.toNumber(),
      expectedNextPrize,
      "next prize follows the landed tile's own effect, not base + old prize"
    );

    const treasuryAfter = await provider.connection.getBalance(treasury);
    assert.equal(
      treasuryAfter,
      treasuryBefore,
      "no funds moved without a payout -- proves rollover accumulation is gone"
    );

    let msg = "";
    try {
      await program.methods
        .payout()
        .accounts({
          payer: authority.publicKey,
          config,
          round,
          treasury,
          pick: h.pickPda(pid, roundId, guesser.publicKey),
          winner: guesser.publicKey,
        })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /NoWinners/, "payout on a zero-winner round must revert");
  });

  it("reverts open_round with InsufficientTreasury once funds can't cover the next prize", async () => {
    // Deliberately drain the treasury (rather than hand-computing the exact
    // remaining balance from every earlier test's dynamic prize amounts):
    // repeatedly run a real single-winner round, preferring a Pump landing
    // (the largest possible next requirement) so this converges quickly.
    const MAX_DRAIN_ROUNDS = 8;

    for (let i = 0; i < MAX_DRAIN_ROUNDS; i++) {
      const cfgNow = await program.account.globalConfig.fetch(config);
      const required = cfgNow.nextPrizeLamports.toNumber();
      const treasuryBal = await provider.connection.getBalance(treasury);
      if (treasuryBal < required) break; // already insolvent -- ready to assert below

      const sum = reachablePumpSum(cfgNow.avatarPosition, NUM_TILES) ?? 7;
      const winner = Keypair.generate();
      await airdrop(provider, winner, 0.1);

      const { roundId, round } = await openRevealRound(ctx, sum, [{ kp: winner, guess: sum }]);
      await tallyAndSettle(ctx, roundId, round, [winner.publicKey]);
      await program.methods
        .payout()
        .accounts({
          payer: authority.publicKey,
          config,
          round,
          treasury,
          pick: h.pickPda(pid, roundId, winner.publicKey),
          winner: winner.publicKey,
        })
        .rpc();
    }

    const cfgFinal = await program.account.globalConfig.fetch(config);
    const requiredFinal = cfgFinal.nextPrizeLamports.toNumber();
    const treasuryFinal = await provider.connection.getBalance(treasury);
    assert.isBelow(
      treasuryFinal,
      requiredFinal,
      "test setup should have drained the treasury below the next required prize"
    );

    const roundId = cfgFinal.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    let msg = "";
    try {
      await program.methods
        .openRound(h.commitOf(h.randomSeed()))
        .accounts({ authority: authority.publicKey, config, treasury, round, systemProgram: SystemProgram.programId })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /InsufficientTreasury/, "underfunded open_round must revert");
  });

  it("refuses to settle while any pick is untallied", async () => {
    // The guard that makes `winners_count` trustworthy: without it the
    // authority could settle having counted only a convenient subset.
    // The solvency spec above deliberately empties the treasury, and these two
    // run after it -- top it back up or `open_round` reverts before the
    // behaviour under test is ever reached.
    await program.methods
      .fundTreasury(new anchor.BN(3 * LAMPORTS_PER_SOL))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();

    const a = Keypair.generate();
    const b = Keypair.generate();
    await airdrop(provider, a);
    await airdrop(provider, b);
    const sum = 7;
    const { roundId, round } = await openRevealRound(ctx, sum, [
      { kp: a, guess: sum },
      { kp: b, guess: sum },
    ]);

    // Tally only one of the two.
    await program.methods
      .tally()
      .accounts({ authority: authority.publicKey, config, round })
      .remainingAccounts([
        { pubkey: h.pickPda(pid, roundId, a.publicKey), isSigner: false, isWritable: true },
      ])
      .rpc();

    let msg = "";
    try {
      await program.methods
        .settle()
        .accounts({ authority: authority.publicKey, config, round })
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TallyIncomplete/, "settle must wait for a complete tally");

    // Finish the tally and confirm it now settles with the real count.
    await program.methods
      .tally()
      .accounts({ authority: authority.publicKey, config, round })
      .remainingAccounts([
        { pubkey: h.pickPda(pid, roundId, b.publicKey), isSigner: false, isWritable: true },
      ])
      .rpc();
    await program.methods
      .settle()
      .accounts({ authority: authority.publicKey, config, round })
      .rpc();
    const settled = await program.account.round.fetch(round);
    assert.equal(settled.winnersCount, 2);
  });

  it("counts a pick once however many times its batch is retried", async () => {
    // The coordinator retries batches on RPC failure, so double counting here
    // would inflate `winners_count` and shrink every share.
    // The solvency spec above deliberately empties the treasury, and these two
    // run after it -- top it back up or `open_round` reverts before the
    // behaviour under test is ever reached.
    await program.methods
      .fundTreasury(new anchor.BN(3 * LAMPORTS_PER_SOL))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();

    const solo = Keypair.generate();
    await airdrop(provider, solo);
    const sum = 7;
    const { roundId, round } = await openRevealRound(ctx, sum, [{ kp: solo, guess: sum }]);

    const batch = {
      pubkey: h.pickPda(pid, roundId, solo.publicKey),
      isSigner: false,
      isWritable: true,
    };
    for (let i = 0; i < 3; i++) {
      await program.methods
        .tally()
        .accounts({ authority: authority.publicKey, config, round })
        .remainingAccounts([batch])
        .rpc();
    }

    const r = await program.account.round.fetch(round);
    assert.equal(r.tallied, 1, "three identical batches must count one pick once");
    assert.equal(r.winnersCount, 1);
  });
});
