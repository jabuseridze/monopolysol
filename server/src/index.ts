import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents, SOCKET_EVENTS } from "@monopoly-sol/shared";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { Emitter } from "./emitter.js";
import { GuessIntake } from "./guessIntake.js";
import { PayoutQueue } from "./payouts.js";
import { PickSweeper } from "./pickSweeper.js";
import { PresenceTracker } from "./presence.js";
import { RoundLoop } from "./roundLoop.js";

async function main() {
  const cfg = loadConfig();
  const app = express();
  app.use(cors({ origin: cfg.corsOrigins }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: cfg.corsOrigins },
  });

  const chain = new Chain(cfg);

  const emit: Emitter = {
    state: (s) => io.emit(SOCKET_EVENTS.roundState, s),
    tick: (roundId, secondsLeft, locksAtWall, phase) =>
      io.emit(SOCKET_EVENTS.tick, { roundId, secondsLeft, locksAtWall, phase }),
    drawCue: (roundId, leadSeconds) =>
      io.emit(SOCKET_EVENTS.drawCue, { roundId, leadSeconds }),
    drawResult: (roundId, diceA, diceB, startTile, landedTile, revealedSeed, commitHash) =>
      io.emit(SOCKET_EVENTS.drawResult, {
        roundId,
        diceA,
        diceB,
        startTile,
        landedTile,
        revealedSeed,
        commitHash,
      }),
    settled: (roundId, landedTile, winners, prizeLamports, shareLamports) =>
      io.emit(SOCKET_EVENTS.settled, {
        roundId,
        landedTile,
        winners,
        prizeLamports,
        shareLamports,
      }),
    payouts: (p) => io.emit(SOCKET_EVENTS.payouts, p),
  };

  const payouts = new PayoutQueue(chain, emit.payouts);
  const sweeper = new PickSweeper(chain);
  const loop = new RoundLoop(chain, emit, cfg.masterSecret, payouts, sweeper);

  // The guessing window, read fresh on every request. `locksAtWall` is the
  // wall-clock deadline; `locksAt` is on the cluster clock, which runs at a
  // different rate on a local validator and would reject guesses early.
  const intake = new GuessIntake(cfg, chain, () => {
    const s = loop.getSnapshot();
    return { roundId: s.roundId, locksAt: s.locksAtWall, open: s.phase === "open" };
  });

  const presence = new PresenceTracker(
    () => loop.getSnapshot().guessCounts,
    (p) => io.emit(SOCKET_EVENTS.presence, p)
  );

  io.on("connection", (socket) => {
    // Send the current snapshot immediately so late joiners are in sync.
    socket.emit(SOCKET_EVENTS.roundState, loop.getSnapshot());

    socket.on("client:hello", (walletBase58) => presence.hello(socket.id, walletBase58));

    // Players paste an address instead of connecting a wallet, so the
    // coordinator signs and funds their pick. `guessIntake` holds every limit
    // that keeps that from draining the house wallet.
    socket.on("client:guess", (p, ack) => {
      void intake
        .submit(socket.id, p?.address ?? "", p?.sum ?? -1)
        .then(ack)
        .catch(() => ack({ ok: false, reason: "Couldn't submit that guess. Try again." }));
    });

    // Walletless players cannot sign a payout for themselves, so this is their
    // only recovery path if the queue gave up. Safe for anyone to call: the
    // destination is pinned on-chain to the winner.
    socket.on("client:retryPayout", (p, ack) => {
      const roundId = Number(p?.roundId);
      if (!Number.isInteger(roundId) || roundId < 0) {
        return ack({ ok: false, reason: "Unknown round." });
      }
      void loop
        .retryPayouts(roundId)
        .then(ack)
        .catch(() => ack({ ok: false, reason: "Couldn't reach the chain. Try again." }));
    });

    socket.on("disconnect", () => {
      presence.disconnect(socket.id);
      intake.forget(socket.id);
    });
  });

  server.listen(cfg.port, () => {
    console.log(`[coordinator] listening on :${cfg.port}`);
    console.log(`[coordinator] program ${cfg.programId.toBase58()}`);
    console.log(`[coordinator] authority ${cfg.authority.publicKey.toBase58()}`);
  });

  await loop.run();
}

main().catch((err) => {
  console.error("[coordinator] fatal:", err);
  process.exit(1);
});
