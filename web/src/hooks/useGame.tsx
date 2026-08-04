"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  DrawCueDTO,
  DrawResultDTO,
  PresenceDTO,
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
  /** Distinct connected wallets, from the coordinator's throttled presence broadcast. */
  onlineWallets: number;
  /** Live guess-sum tally, refreshed alongside `onlineWallets`. */
  guessCounts: Record<number, number>;
}

const initialState: GameState = {
  connected: false,
  round: null,
  drawCue: null,
  drawResult: null,
  settled: null,
  onlineWallets: 0,
  guessCounts: {},
};

const GameContext = createContext<GameState>(initialState);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const { publicKey } = useWallet();
  const walletRef = useRef<string | null>(null);

  // Re-announce the wallet to the coordinator whenever it connects/changes/
  // disconnects, so presence tracking stays accurate without waiting for a
  // socket reconnect. Buffered by socket.io-client if the socket isn't
  // connected yet; flushed once it is.
  useEffect(() => {
    walletRef.current = publicKey ? publicKey.toBase58() : null;
    socketRef.current?.emit("client:hello", walletRef.current);
  }, [publicKey]);

  useEffect(() => {
    // socket.io-client 4.8.3's `io()`/`lookup()` factory isn't itself
    // generic (only the `Socket` class is) -- typing the variable is the
    // supported way to get the same typed-events effect as the brief's
    // `io<ServerToClientEvents, ClientToServerEvents>(...)` call syntax.
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(WS_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setState((s) => ({ ...s, connected: true }));
      socket.emit("client:hello", walletRef.current);
    });
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));

    socket.on(SOCKET_EVENTS.roundState, (round: RoundStateDTO) =>
      setState((s) => ({ ...s, round }))
    );
    socket.on(SOCKET_EVENTS.tick, (t: TickDTO) =>
      setState((s) =>
        s.round && s.round.roundId === t.roundId
          ? {
              ...s,
              round: {
                ...s.round,
                secondsLeft: t.secondsLeft,
                // The refreshed deadline is the load-bearing field: `Countdown`
                // counts down against this locally rather than echoing
                // `secondsLeft`, which is measured on the cluster clock.
                locksAtWall: t.locksAtWall,
                phase: t.phase,
              },
            }
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
    socket.on(SOCKET_EVENTS.presence, (p: PresenceDTO) =>
      setState((s) => ({ ...s, onlineWallets: p.onlineWallets, guessCounts: p.guessCounts }))
    );

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return <GameContext.Provider value={state}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);
