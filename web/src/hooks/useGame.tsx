"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  AckResult,
  ClientToServerEvents,
  DrawCueDTO,
  DrawResultDTO,
  PresenceDTO,
  RoundStateDTO,
  ServerToClientEvents,
  SettledDTO,
  PayoutProgressDTO,
  SOCKET_EVENTS,
  TickDTO,
} from "@monopoly-sol/shared";
import { WS_URL } from "@/lib/env";
import { useIdentity } from "./useIdentity";

interface GameState {
  connected: boolean;
  round: RoundStateDTO | null;
  /** Transient cues carry a timestamp so effects can react on change. */
  drawCue: (DrawCueDTO & { at: number }) | null;
  drawResult: (DrawResultDTO & { at: number }) | null;
  settled: (SettledDTO & { at: number }) | null;
  /** Payout signatures for `settled`'s round, arriving after it as the
   * coordinator's background queue drains. Null until the first update. */
  payouts: PayoutProgressDTO | null;
  /** Distinct connected wallets, from the coordinator's throttled presence broadcast. */
  onlineWallets: number;
  /** Live guess-sum tally, refreshed alongside `onlineWallets`. */
  guessCounts: Record<number, number>;
  /**
   * Send an acked request to the coordinator.
   *
   * Players cannot sign, so anything that touches the chain on their behalf --
   * submitting a guess, retrying a payout -- is a request to the server rather
   * than a transaction. Exposed here because the socket lives in this provider
   * and there is exactly one of it.
   */
  ask: <E extends "client:guess" | "client:retryPayout">(
    event: E,
    payload: E extends "client:guess"
      ? { address: string; sum: number }
      : { roundId: number }
  ) => Promise<AckResult>;
}

const initialState: GameState = {
  connected: false,
  round: null,
  drawCue: null,
  drawResult: null,
  settled: null,
  payouts: null,
  onlineWallets: 0,
  guessCounts: {},
  ask: async () => ({ ok: false, reason: "Not connected to the game yet." }),
};

/** How long to wait for the coordinator to answer before giving up. */
const ACK_TIMEOUT_MS = 12000;

const GameContext = createContext<GameState>(initialState);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const { address } = useIdentity();
  const walletRef = useRef<string | null>(null);

  // Re-announce the wallet to the coordinator whenever it connects/changes/
  // disconnects, so presence tracking stays accurate without waiting for a
  // socket reconnect. Buffered by socket.io-client if the socket isn't
  // connected yet; flushed once it is.
  useEffect(() => {
    walletRef.current = address;
    socketRef.current?.emit("client:hello", walletRef.current);
  }, [address]);

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
      // A new settlement clears the previous round's payout progress --
      // otherwise stale signatures would make this round's winners look
      // already-paid and hide their claim button.
      setState((s) => ({ ...s, settled: { ...r, at: Date.now() }, payouts: null }))
    );
    socket.on(SOCKET_EVENTS.payouts, (p: PayoutProgressDTO) =>
      setState((s) =>
        // Payouts outlive the round that produced them, so a late message from
        // an earlier round must not overwrite the current one's progress.
        s.settled && s.settled.roundId !== p.roundId ? s : { ...s, payouts: p }
      )
    );
    socket.on(SOCKET_EVENTS.presence, (p: PresenceDTO) =>
      setState((s) => ({ ...s, onlineWallets: p.onlineWallets, guessCounts: p.guessCounts }))
    );

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  // Times out rather than hanging: a socket that has silently dropped would
  // otherwise leave the guess button spinning with no error the player can act
  // on. socket.io's own ack timeout only applies with `.timeout()`, which is
  // awkward to type through the generic signature above.
  const ask = useCallback<GameState["ask"]>((event, payload) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return Promise.resolve({ ok: false as const, reason: "Not connected to the game." });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, reason: "The game didn't respond. Try again." }),
        ACK_TIMEOUT_MS
      );
      const done = (r: AckResult) => {
        clearTimeout(timer);
        resolve(r);
      };
      // The two events have different payload shapes but identical ack shapes;
      // the generic on `ask` keeps callers honest, and this cast is confined
      // to the one line socket.io cannot narrow on its own.
      (socket.emit as (e: string, p: unknown, ack: (r: AckResult) => void) => void)(
        event,
        payload,
        done
      );
    });
  }, []);

  const value = useMemo(() => ({ ...state, ask }), [state, ask]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);
