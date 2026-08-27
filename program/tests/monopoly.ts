import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";
import { landingFor, nextPrizeForLanding } from "@monopoly-sol/shared/effects";
import { airdrop, openRevealRound, reachablePumpSum, tallyAndSettle, PUMP_TILES, RoundCtx } from "./roundOrchestration";

const NUM_TILES = 40;
const PRIZE = LAMPORTS_PER_SOL / 2; // 0.5 SOL
const DURATION = 8; // short for tests, but long enough for two sequential airdrop+confirm round-trips

describe("monopoly: happy path + split payout", () => {
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

  it("initializes config + treasury", async () => {
    // ensureInitialized() in before() already created config+treasury (idempotently,
    // since mocha may run monopoly.errors.ts first and initialize there instead).
    // avatarPosition/nextPrizeLamports are NOT asserted here -- by the time this
    // file's tests run, monopoly.errors.ts has already moved the avatar (see its
    // "initializes with the avatar at tile 0" test, the only safe place for that
    // absolute-position assertion). numTiles/prizeLamports never change post-init.
    const cfg = await program.account.globalConfig.fetch(config);
    assert.equal(cfg.numTiles, NUM_TILES);
    assert.equal(cfg.prizeLamports.toNumber(), PRIZE);
  });

  it("funds the treasury", async () => {
    await program.methods
      .fundTreasury(new anchor.BN(3 * LAMPORTS_PER_SOL))
      .accounts({ funder: authority.publicKey, treasury, systemProgram: SystemProgram.programId })
      .rpc();
    const bal = await provider.connection.getBalance(treasury);
    assert.isAtLeast(bal, 3 * LAMPORTS_PER_SOL);
  });

  it("runs a full round with two winners splitting the prize", async () => {
    const cfgBefore = await program.account.globalConfig.fetch(config);
    const posBefore = cfgBefore.avatarPosition;
    const sum = 7;
    const { landedTile } = landingFor(posBefore, sum, NUM_TILES);

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const carol = Keypair.generate();
    await Promise.all([airdrop(provider, alice), airdrop(provider, bob), airdrop(provider, carol)]);
    const carolGuess = sum === 12 ? 2 : sum + 1; // deliberately not the winning sum

    const { roundId, round } = await openRevealRound(ctx, sum, [
      { kp: alice, guess: sum },
      { kp: bob, guess: sum },
      { kp: carol, guess: carolGuess },
    ]);

    const drawn = await program.account.round.fetch(round);
    assert.equal(drawn.diceA + drawn.diceB, sum);
    assert.equal(drawn.startTile, posBefore);
    assert.equal(drawn.landedTile, landedTile);

    const cfgAfter = await program.account.globalConfig.fetch(config);
    assert.equal(cfgAfter.avatarPosition, (posBefore + sum) % NUM_TILES);

    // EVERY pick must be tallied, losers included -- `settle` refuses while any
    // remain unvisited, which is what makes the count trustworthy. Omitting
    // carol here is exactly the mistake the check exists to catch.
    await tallyAndSettle(ctx, roundId, round, [
      alice.publicKey,
      bob.publicKey,
      carol.publicKey,
    ]);

    // The count came from the chain, not from this test asserting it.
    const settled = await program.account.round.fetch(round);
    assert.equal(settled.winnersCount, 2, "only the two correct guesses counted");
    assert.equal(settled.tallied, 3, "every pick visited, losers included");

    const share = drawn.prizeLamports.toNumber() / 2;
    for (const player of [alice, bob]) {
      const before = await provider.connection.getBalance(player.publicKey);
      await program.methods
        .payout()
        .accounts({
          payer: authority.publicKey,
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

  it("re-arms the next prize when the avatar lands on a Random Pump tile", async () => {
    let cfgNow = await program.account.globalConfig.fetch(config);
    let pos = cfgNow.avatarPosition;
    let pumpSum = reachablePumpSum(pos, NUM_TILES);

    if (pumpSum === null) {
      // Walk the avatar to a position from which a Pump tile is reachable.
      // Guaranteed to exist: only 7/40 positions have no reachable Pump tile,
      // so at least 4 of the 11 candidates reachable from `pos` escape that set.
      let setupSum = -1;
      for (let s = 2; s <= 12; s++) {
        if (reachablePumpSum((pos + s) % NUM_TILES, NUM_TILES) !== null) {
          setupSum = s;
          break;
        }
      }
      if (setupSum === -1) throw new Error("no reachable position leads to a Pump tile");
      await openRevealRound(ctx, setupSum);
      cfgNow = await program.account.globalConfig.fetch(config);
      pos = cfgNow.avatarPosition;
      pumpSum = reachablePumpSum(pos, NUM_TILES);
    }
    assert.isNotNull(pumpSum, "a Pump tile must be reachable after the setup walk");

    const { landedTile, passedOrLandedGo } = landingFor(pos, pumpSum!, NUM_TILES);
    assert.include(PUMP_TILES, landedTile, "forced landing must be a Pump tile");
    // Computed via the shared TS effects table (not hardcoded to 1 SOL) so this
    // also holds in the rare case the same roll both lands on Pump AND passes
    // GO (bonus stacks) -- proving Rust/TS parity in every case, not just the
    // common one.
    const expectedPrize = nextPrizeForLanding({ landedTile, passedOrLandedGo });

    const { round: round1 } = await openRevealRound(ctx, pumpSum!);
    const drawn1 = await program.account.round.fetch(round1);
    assert.equal(drawn1.landedTile, landedTile);
    assert.equal(drawn1.nextPrizeLamports.toNumber(), expectedPrize);

    const cfgAfterReveal = await program.account.globalConfig.fetch(config);
    assert.equal(cfgAfterReveal.nextPrizeLamports.toNumber(), expectedPrize);

    // Open the next round: it must consume the armed Pump prize, then the
    // config re-arms back to base per the "consume and re-arm" rule in
    // open_round.rs.
    const nextRoundId = cfgAfterReveal.currentRound.toNumber() + 1;
    const nextRound = h.roundPda(pid, nextRoundId);
    await program.methods
      .openRound(h.commitOf(h.randomSeed()))
      .accounts({ authority: authority.publicKey, config, treasury, round: nextRound, systemProgram: SystemProgram.programId })
      .rpc();
    const opened = await program.account.round.fetch(nextRound);
    assert.equal(opened.prizeLamports.toNumber(), expectedPrize);

    const cfgAfterOpen = await program.account.globalConfig.fetch(config);
    assert.equal(cfgAfterOpen.nextPrizeLamports.toNumber(), PRIZE, "re-armed back to base");
  });
});
