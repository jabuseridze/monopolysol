"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  DrawCueDTO,
  DrawResultDTO,
  RoundStateDTO,
  ServerToClientEvents,
  SettledDTO,
  SOCKET_EVENTS,
  TickDTO,
} from "@monopoly-sol/shared";
import { WS_URL } from "@/lib/env";

interface GameState {
  connected: boolean;
  round: RoundStateDTO | null;
  /** Transient cues carry a timestamp so effects can react on change. */
  drawCue: (DrawCueDTO & { at: number }) | null;
  drawResult: (DrawResultDTO & { at: number }) | null;
  settled: (SettledDTO & { at: number }) | null;
}

const GameContext = createContext<GameState>({
  connected: false,
  round: null,
  drawCue: null,
  drawResult: null,
  settled: null,
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>({
    connected: false,
    round: null,
    drawCue: null,
    drawResult: null,
    settled: null,
  });
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    // socket.io-client 4.8.3's `io()`/`lookup()` factory isn't itself
    // generic (only the `Socket` class is) -- typing the variable is the
    // supported way to get the same typed-events effect as the brief's
    // `io<ServerToClientEvents, ClientToServerEvents>(...)` call syntax.
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(WS_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setState((s) => ({ ...s, connected: true })));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));

    socket.on(SOCKET_EVENTS.roundState, (round: RoundStateDTO) =>
      setState((s) => ({ ...s, round }))
    );
    socket.on(SOCKET_EVENTS.tick, (t: TickDTO) =>
      setState((s) =>
        s.round && s.round.roundId === t.roundId
          ? { ...s, round: { ...s.round, secondsLeft: t.secondsLeft, phase: t.phase } }
          : s
      )
    );
    socket.on(SOCKET_EVENTS.drawCue, (c: DrawCueDTO) =>
      setState((s) => ({ ...s, drawCue: { ...c, at: Date.now() } }))
    );
    socket.on(SOCKET_EVENTS.drawResult, (r: DrawResultDTO) =>
      setState((s) => ({ ...s, drawResult: { ...r, at: Date.now() } }))
    );
    socket.on(SOCKET_EVENTS.settled, (r: SettledDTO) =>
      setState((s) => ({ ...s, settled: { ...r, at: Date.now() } }))
    );

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return <GameContext.Provider value={state}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);
