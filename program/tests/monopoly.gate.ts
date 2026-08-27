import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import { Monopoly } from "../target/types/monopoly";
import * as h from "./helpers";

/**
 * The token gate on `submit_guess`.
 *
 * Every test here arms the gate and the `after()` hook disarms it again. That
 * teardown is load-bearing, not tidiness: the gate lives in `GlobalConfig`,
 * which is shared mutable state across the whole suite, and every other spec
 * file submits guesses with no token account. Leaving the gate armed would
 * fail them all with `TokenGateFailed` and make this file look innocent.
 */
describe("monopoly: token gate", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Monopoly as Program<Monopoly>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const authority = (provider.wallet as anchor.Wallet).payer;
  const pid = program.programId;

  // Must match the other spec files: whichever runs first wins, because
  // `ensureInitialized` is a no-op once the config exists. Declaring a
  // different value here would not change the chain, only mislead the reader.
  const PRIZE = 0.5 * anchor.web3.LAMPORTS_PER_SOL;
  const NUM_TILES = 40;
  const ROUND_DURATION = 8;

  let config: PublicKey;
  let treasury: PublicKey;
  /** The mint the gate is armed on. */
  let gateMint: PublicKey;
  /** A different mint, to prove the gate checks *which* token is held. */
  let otherMint: PublicKey;

  const airdrop = async (kp: Keypair, sol = 2) => {
    const sig = await provider.connection.requestAirdrop(
      kp.publicKey,
      sol * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  };

  /** Open a fresh round and return its id + PDA. */
  const openRound = async () => {
    const cfg = await program.account.globalConfig.fetch(config);
    const roundId = cfg.currentRound.toNumber() + 1;
    const round = h.roundPda(pid, roundId);
    await program.methods
      .openRound(h.commitOf(h.randomSeed()))
      .accounts({
        authority: authority.publicKey,
        config,
        treasury,
        round,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { roundId, round };
  };

  const setGate = (mint: PublicKey) =>
    program.methods
      .setGate(mint)
      .accounts({ authority: authority.publicKey, config })
      .rpc();

  const guess = (
    player: Keypair,
    roundId: number,
    round: PublicKey,
    tokenAccount: PublicKey | null,
    sum = 7
  ) =>
    program.methods
      .submitGuess(sum)
      .accounts({
        // Coordinator submits; the player never signs. The gate is still
        // enforced against `player`, which is the property these specs exist
        // to pin down.
        payer: authority.publicKey,
        player: player.publicKey,
        config,
        round,
        pick: h.pickPda(pid, roundId, player.publicKey),
        systemProgram: SystemProgram.programId,
        playerTokenAccount: tokenAccount,
      })
      .rpc();

  before(async () => {
    config = await h.ensureInitialized(
      program,
      authority,
      PRIZE,
      NUM_TILES,
      ROUND_DURATION
    );
    treasury = h.treasuryPda(pid);

    // Top up ONLY the shortfall needed for `open_round`'s solvency check.
    //
    // These tests open rounds but never settle or pay out, so nothing is
    // actually spent -- the treasury just has to clear the bar. Funding a flat
    // amount here would be a bug: a later spec deliberately drains the
    // treasury to assert `open_round` reverts with `InsufficientTreasury`, and
    // every surplus SOL left behind is SOL that drain has to get through
    // first. Adding 5 SOL made that test fail.
    const cfg = await program.account.globalConfig.fetch(config);
    const needed = cfg.nextPrizeLamports.toNumber();
    const have = await provider.connection.getBalance(treasury);
    if (have < needed) {
      await program.methods
        .fundTreasury(new anchor.BN(needed - have))
        .accounts({
          funder: authority.publicKey,
          config,
          treasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    gateMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      0
    );
    otherMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      0
    );
  });

  after(async () => {
    // MUST run: see the file header.
    await setGate(PublicKey.default);
    const cfg = await program.account.globalConfig.fetch(config);
    assert.isTrue(
      cfg.gateMint.equals(PublicKey.default),
      "gate must be disarmed for the rest of the suite"
    );
  });

  it("starts disarmed, so a guess needs no token account at all", async () => {
    await setGate(PublicKey.default);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    await guess(player, roundId, round, null);

    const pick = await program.account.playerPick.fetch(
      h.pickPda(pid, roundId, player.publicKey)
    );
    assert.equal(pick.guess, 7);
  });

  it("lets a holder play once armed", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    const ata = await createAssociatedTokenAccount(
      provider.connection,
      player,
      gateMint,
      player.publicKey
    );
    await mintTo(provider.connection, authority, gateMint, ata, authority, 1);

    await guess(player, roundId, round, ata);

    const pick = await program.account.playerPick.fetch(
      h.pickPda(pid, roundId, player.publicKey)
    );
    assert.equal(pick.guess, 7, "holder should be able to guess");
  });

  it("rejects a zero balance -- an empty account is free to create", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    // Correct mint, correct owner, but never funded.
    const ata = await createAssociatedTokenAccount(
      provider.connection,
      player,
      gateMint,
      player.publicKey
    );

    let msg = "";
    try {
      await guess(player, roundId, round, ata);
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TokenGateFailed/);
  });

  it("rejects omitting the token account entirely", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    let msg = "";
    try {
      await guess(player, roundId, round, null);
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TokenGateFailed/);
  });

  it("rejects a funded account for the wrong mint", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    // Plenty of a token nobody asked for.
    const ata = await createAssociatedTokenAccount(
      provider.connection,
      player,
      otherMint,
      player.publicKey
    );
    await mintTo(provider.connection, authority, otherMint, ata, authority, 999);

    let msg = "";
    try {
      await guess(player, roundId, round, ata);
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TokenGateFailed/);
  });

  it("rejects borrowing someone else's holdings", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const holder = Keypair.generate();
    const freeloader = Keypair.generate();
    await airdrop(holder);
    await airdrop(freeloader);

    // A real, funded account -- just not the guesser's.
    const holderAta = await createAssociatedTokenAccount(
      provider.connection,
      holder,
      gateMint,
      holder.publicKey
    );
    await mintTo(
      provider.connection,
      authority,
      gateMint,
      holderAta,
      authority,
      100
    );

    let msg = "";
    try {
      await guess(freeloader, roundId, round, holderAta);
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TokenGateFailed/);
  });

  it("rejects an account owned by neither token program", async () => {
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    await airdrop(player);

    // The config PDA is a real account of ample length owned by *this*
    // program -- proof the gate checks the owning program, not just bytes.
    let msg = "";
    try {
      await guess(player, roundId, round, config);
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /TokenGateFailed/);
  });

  it("lets the coordinator submit for an address that never signs", async () => {
    // The whole point of walletless play: a player pastes an address, holds no
    // SOL and signs nothing, and the coordinator creates the pick for them.
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate(); // deliberately NOT airdropped
    const ata = await createAssociatedTokenAccount(
      provider.connection,
      authority,
      gateMint,
      player.publicKey
    );
    await mintTo(provider.connection, authority, gateMint, ata, authority, 1);

    await guess(player, roundId, round, ata);

    const pick = await program.account.playerPick.fetch(
      h.pickPda(pid, roundId, player.publicKey)
    );
    assert.strictEqual(
      pick.player.toBase58(),
      player.publicKey.toBase58(),
      "the pick must belong to the pasted address, not the payer"
    );
    assert.strictEqual(
      await provider.connection.getBalance(player.publicKey),
      0,
      "the player should never have needed any SOL"
    );
  });

  it("rejects a non-authority trying to submit a guess", async () => {
    // Without this the gate would be pointless: anyone could create picks for
    // any address straight against the program, and no server-side rate limit
    // could reach them.
    await setGate(gateMint);
    const { roundId, round } = await openRound();
    const player = Keypair.generate();
    const stranger = Keypair.generate();
    await airdrop(stranger);
    const ata = await createAssociatedTokenAccount(
      provider.connection,
      authority,
      gateMint,
      player.publicKey
    );
    await mintTo(provider.connection, authority, gateMint, ata, authority, 1);

    let msg = "";
    try {
      await program.methods
        .submitGuess(7)
        .accounts({
          payer: stranger.publicKey,
          player: player.publicKey,
          config,
          round,
          pick: h.pickPda(pid, roundId, player.publicKey),
          systemProgram: SystemProgram.programId,
          playerTokenAccount: ata,
        })
        .signers([stranger])
        .rpc();
    } catch (e: any) {
      msg = e.toString();
    }
    assert.match(msg, /Unauthorized|ConstraintAddress/);
  });
});
