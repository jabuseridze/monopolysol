import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents, SOCKET_EVENTS } from "@monopoly-sol/shared";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { Emitter } from "./emitter.js";
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
    tick: (roundId, secondsLeft, phase) =>
      io.emit(SOCKET_EVENTS.tick, { roundId, secondsLeft, phase }),
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
    settled: (roundId, landedTile, winners, prizeLamports, shareLamports, txSignature) =>
      io.emit(SOCKET_EVENTS.settled, {
        roundId,
        landedTile,
        winners,
        prizeLamports,
        shareLamports,
        txSignature,
      }),
  };

  const loop = new RoundLoop(chain, emit, cfg.roundSecretPath);

  io.on("connection", (socket) => {
    // Send the current snapshot immediately so late joiners are in sync.
    socket.emit(SOCKET_EVENTS.roundState, loop.getSnapshot());
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
