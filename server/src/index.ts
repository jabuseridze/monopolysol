import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents, SOCKET_EVENTS } from "@monopoly-sol/shared";
import { loadConfig } from "./config.js";
import { migrate } from "./db/client.js";
import { Emitter } from "./emitter.js";
import { GuessIntake } from "./guessIntake.js";
import { PayoutQueue } from "./payouts.js";
import { PresenceTracker } from "./presence.js";
import { RoundLoop } from "./roundLoop.js";
import { solOf, Wallet } from "./wallet.js";

async function main() {
  const cfg = loadConfig();
  const app = express();
  app.use(cors({ origin: cfg.corsOrigins }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Before anything can serve: a round that is not written here is a round a
  // redeploy loses, along with its guesses and the obligation to pay them.
  await migrate();

  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: cfg.corsOrigins },
  });

  const wallet = new Wallet(cfg.rpcUrl, cfg.payer, cfg.gateMint);

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

  const payouts = new PayoutQueue(wallet, emit.payouts);
  const loop = new RoundLoop(wallet, emit, cfg.masterSecret, payouts, cfg.basePrizeLamports);

  // The guessing window, read fresh on every request.
  const intake = new GuessIntake(cfg, wallet, () => {
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
    // coordinator records the pick on their behalf. `guessIntake` holds every
    // limit bounding how many claims one connection can stake on the pot.
    socket.on("client:guess", (p, ack) => {
      void intake
        .submit(socket.id, p?.address ?? "", p?.sum ?? -1)
        .then(ack)
        .catch(() => ack({ ok: false, reason: "Couldn't submit that guess. Try again." }));
    });

    // Walletless players cannot pay themselves, so this is their only recovery
    // path if the queue gave up. Safe for anyone to call: the destination and
    // the share are re-read from storage, never taken from the caller.
    socket.on("client:retryPayout", (p, ack) => {
      const roundId = Number(p?.roundId);
      if (!Number.isInteger(roundId) || roundId < 0) {
        return ack({ ok: false, reason: "Unknown round." });
      }
      void loop
        .retryPayouts(roundId)
        .then(ack)
        .catch(() => ack({ ok: false, reason: "Couldn't reach the payout queue. Try again." }));
    });

    socket.on("disconnect", () => {
      presence.disconnect(socket.id);
      intake.forget(socket.id);
    });
  });

  server.listen(cfg.port, () => {
    console.log(`[coordinator] listening on :${cfg.port}`);
    console.log(`[coordinator] payout wallet ${wallet.address.toBase58()}`);
    console.log(`[coordinator] gate ${cfg.gateMint?.toBase58() ?? "disabled (anyone may play)"}`);
  });

  const lamports = await wallet.balance();
  console.log(`[coordinator] payout wallet holds ${solOf(lamports).toFixed(4)} SOL`);

  await loop.run();
}

main().catch((err) => {
  console.error("[coordinator] fatal:", err);
  process.exit(1);
});
