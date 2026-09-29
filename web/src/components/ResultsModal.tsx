"use client";

import { useEffect, useState } from "react";
import { drawSequenceDurationMs, getTile, lamportsToSol } from "@monopoly-sol/shared";
import { solscanAccount, solscanTx } from "@monopoly-sol/shared/explorer";
import { useIdentity } from "@/hooks/useIdentity";
import { useRetryPayout } from "@/hooks/useRetryPayout";
import { useGame } from "@/hooks/useGame";
import { CLUSTER, EXPLORER_ON } from "@/lib/explorerLinks";
import { Confetti } from "./Confetti";

/**
 * How long the result stays up. The show/hide timers below are the sole owner
 * of that: this used to also close the instant the next round opened, which
 * the coordinator does only ~600ms after the choreography ends -- so the
 * announcement flashed up and vanished before it could be read. Covering the
 * first ~2.4s of a 100-second guessing window costs nothing by comparison.
 */
const VISIBLE_MS = 3000;

export function ResultsModal() {
  const { round, settled, drawResult, payouts } = useGame();
  // The pasted address -- the game's only identity.
  const identity = useIdentity();
  const { retryPayout, pending: retryPending, error: retryError } = useRetryPayout();
  const [open, setOpen] = useState(false);

  const settledAt = settled?.at ?? null;
  const sameRound = settled != null && drawResult != null && drawResult.roundId === settled.roundId;

  // A result older than the round currently in flight is only shown if its own
  // window hasn't elapsed -- the timers below decide that. What this still
  // guards is a client that connects holding a `settled` from a round it never
  // watched, where the timers were never armed.
  const stale =
    settled != null && round != null && round.roundId !== settled.roundId && !sameRound;

  useEffect(() => {
    if (!settled) return;
    setOpen(false);

    // `settled` fires when the last on-chain payout confirms, which with zero
    // winners can be ~1s after the draw -- i.e. while the dice are still
    // tumbling. Announcing then spoils the whole reveal. Hold the result
    // until the choreography has actually finished playing.
    const steps = sameRound ? drawResult!.diceA + drawResult!.diceB : 0;
    const choreographyEndsAt = sameRound
      ? drawResult!.at + drawSequenceDurationMs(steps)
      : Date.now();
    const delay = Math.max(0, choreographyEndsAt - Date.now());

    const show = setTimeout(() => setOpen(true), delay);
    const hide = setTimeout(() => setOpen(false), delay + VISIBLE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledAt]);

  if (!open || stale || !settled) return null;

  const tile = getTile(settled.landedTile);
  // `settled` doesn't itself carry the dice values -- pull them from the
  // `drawResult` broadcast for the same round (fired moments earlier in the
  // same draw sequence) to show the winning sum.
  const dice = drawResult && drawResult.roundId === settled.roundId ? drawResult : null;
  const winningSum = dice ? dice.diceA + dice.diceB : null;
  const you = identity.address;
  const youWon = you ? settled.winners.includes(you) : false;
  // Arrives after `settled`, once the background queue has actually paid this
  // wallet -- so "won" and "paid" are genuinely separate states now.
  const progress = payouts?.roundId === settled.roundId ? payouts : null;
  const yourSignature = you && progress ? progress.paid[you] ?? null : null;
  const paidOut = yourSignature !== null;
  const payoutFailed = !!you && !!progress?.failed.includes(you);
  const share = lamportsToSol(settled.shareLamports);

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(4,7,18,0.45)" }}>
      {youWon && <Confetti />}
      <div className="panel" style={{ padding: 26, width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
          Round #{settled.roundId} result
        </div>
        {dice && (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Dice rolled {dice.diceA} + {dice.diceB} = {winningSum}
          </div>
        )}
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--panel-border)", margin: "6px 0" }}>
          Landed on {tile?.name ?? `Tile ${settled.landedTile}`}
        </div>
        {settled.winners.length === 0 ? (
          // No rollover: `settle.rs` dropped the accumulation branch in the
          // dice-walk pivot, so an unclaimed prize simply stays in the wallet.
          <div style={{ color: "var(--muted)" }}>Nobody guessed it - the prize rolls on.</div>
        ) : (
          <div style={{ fontSize: 15 }}>
            {settled.winners.length} winner{settled.winners.length > 1 ? "s" : ""} guessed{" "}
            <span className="mono" style={{ fontWeight: 700 }}>{winningSum}</span> and split{" "}
            <span className="mono" style={{ fontWeight: 700 }}>{lamportsToSol(settled.prizeLamports).toFixed(2)} SOL</span>
            <div style={{ marginTop: 6 }}>
              <span className="mono">{share.toFixed(4)} SOL</span> each
            </div>
          </div>
        )}
        {youWon && (
          <div style={{ marginTop: 12, color: "var(--good)", fontWeight: 800, fontSize: 18 }}>
            {paidOut ? "You won! Payout sent." : "You won! Paying out..."}
          </div>
        )}
        {/* Only offered once the coordinator has actually given up on this
            address. Showing it while the queue is still working would invite a
            pointless second transaction that the `claimed` flag rejects.

            This asks the *server* to try again rather than signing anything:
            the player pasted an address and holds no key. That is safe because
            `payout` is permissionless and its destination is pinned on-chain
            to the winner, so the worst a spurious retry can do is waste a fee. */}
        {youWon && !paidOut && payoutFailed && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
              The automatic payout didn&apos;t go through. Your {share.toFixed(4)} SOL is
              still assigned to you on-chain — it just needs sending.
            </div>
            <button
              className="btn"
              disabled={retryPending}
              onClick={() => void retryPayout(settled.roundId)}
            >
              {retryPending ? "Sending..." : "Resend payout"}
            </button>
            {retryError && (
              <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 6 }}>{retryError}</div>
            )}
          </div>
        )}
        {youWon && yourSignature && EXPLORER_ON && (
          <a
            href={solscanTx(yourSignature, CLUSTER)}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 8, color: "var(--crate)", fontSize: 12 }}
          >
            View your payout on Solscan
          </a>
        )}
        {/* The wallet the prize actually leaves from. Its Solscan page lists
            every payout to every winner, so anyone can audit the whole game --
            not just their own round. Read from live round state, not env: only
            the server knows which wallet is paying. */}
        {settled.winners.length > 0 && EXPLORER_ON && round?.payoutWallet && (
          <div style={{ marginTop: 10 }}>
            <a
              href={solscanAccount(round.payoutWallet, CLUSTER)}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--crate)", fontSize: 12 }}
            >
              Verify payouts on Solscan
            </a>
          </div>
        )}
        <div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
