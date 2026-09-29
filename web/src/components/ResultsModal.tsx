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
 * announcement flashed up and vanished before it could be read.
 *
 * Six seconds rather than three because the card carries links worth
 * following (a payout signature, the paying wallet) and three seconds was not
 * long enough to read the card *and* decide to click one -- which made those
 * links decorative. It still covers only the first ~6s of a 100-second
 * guessing window.
 */
const VISIBLE_MS = 6000;

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

    // `settled` fires as soon as the round is decided, which can be while the
    // dice are still tumbling. Announcing then spoils the whole reveal. Hold
    // the result until the choreography has actually finished playing.
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
  // wallet -- so "won" and "paid" are genuinely separate states.
  const progress = payouts?.roundId === settled.roundId ? payouts : null;
  const yourSignature = you && progress ? progress.paid[you] ?? null : null;
  const payoutFailed = !!you && !!progress?.failed.includes(you);
  const share = lamportsToSol(settled.shareLamports);
  const others = settled.winners.length - 1;

  return (
    <div className="results-scrim">
      {youWon && <Confetti />}
      <div className="panel results-card">
        <div className="panel-band band-purple">Round {settled.roundId}</div>
        <div className="results-body">
          <div className="results-sum">{winningSum ?? "-"}</div>
          <div className="results-sum-label">Winning sum</div>

          <div className="results-tile">
            <small>Landed on</small>
            {tile?.name ?? `Tile ${settled.landedTile}`}
          </div>

          <div className="results-rule" />

          {settled.winners.length === 0 ? (
            // No rollover: an unclaimed prize simply stays in the wallet.
            <div className="results-nobody">Nobody guessed it — the prize rolls on.</div>
          ) : youWon ? (
            <>
              <div className="results-you-won">You won</div>
              <div className="results-amount">{share.toFixed(3)} SOL</div>
              {/* Says who you shared with, not just how many won -- "split with
                  2 others" answers the question a winner actually has when the
                  number is smaller than the prize they watched. */}
              <div className="results-split">
                {others === 0
                  ? "You were the only winner."
                  : `Split with ${others} other winner${others > 1 ? "s" : ""}.`}
              </div>
              {!yourSignature && !payoutFailed && (
                <div className="results-pending">Sending your payout…</div>
              )}
            </>
          ) : (
            <div className="results-nobody">
              {settled.winners.length} player{settled.winners.length > 1 ? "s" : ""} guessed it
              {" — "}
              <strong>{share.toFixed(3)} SOL</strong> each.
            </div>
          )}

          {/* Only offered once the coordinator has actually given up on this
              address. Showing it while the queue is still working would invite
              a pointless second send, which `picks.paid` rejects anyway. */}
          {youWon && payoutFailed && (
            <div className="results-retry">
              <div className="results-retry-note">
                The automatic payout didn&apos;t go through. Your {share.toFixed(3)} SOL is
                still recorded as yours — it just needs sending.
              </div>
              <button
                className="btn"
                disabled={retryPending}
                onClick={() => void retryPayout(settled.roundId)}
              >
                {retryPending ? "Sending…" : "Resend payout"}
              </button>
              {retryError && <div className="results-error">{retryError}</div>}
            </div>
          )}

          <div className="results-links">
            {youWon && yourSignature && EXPLORER_ON && (
              <a
                className="results-link"
                href={solscanTx(yourSignature, CLUSTER)}
                target="_blank"
                rel="noreferrer"
              >
                Your payout ↗
              </a>
            )}
            {/* The wallet the prize leaves from. Its Solscan page lists every
                payout to every winner, so anyone can audit the whole game --
                not just their own round. Read from live round state, not env:
                only the server knows which wallet is paying. */}
            {settled.winners.length > 0 && EXPLORER_ON && round?.payoutWallet && (
              <a
                className="results-link"
                href={solscanAccount(round.payoutWallet, CLUSTER)}
                target="_blank"
                rel="noreferrer"
              >
                All payouts ↗
              </a>
            )}
            <button className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
