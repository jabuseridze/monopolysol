"use client";

import { solscanAccount } from "@monopoly-sol/shared/explorer";
import { CLUSTER, EXPLORER_ON, TREASURY } from "@/lib/explorerLinks";

/**
 * A standing invitation to check that the house actually pays.
 *
 * The results modal already links to the treasury, but only after a round with
 * a winner and only for three seconds -- so a player who hasn't won yet, or who
 * looked away, has no way to verify anything. For a game asking people to buy a
 * token first, "can I see that payouts are real?" needs an answer that is
 * always on screen, not one that flashes past.
 *
 * It points at the **treasury vault**, not the operator's wallet. That is the
 * account prizes leave from, so its history *is* the payout history; the
 * authority wallet only pays fees and rent and has never sent a prize, so
 * linking it would show a page with no payouts on it.
 *
 * Must be rendered directly from `Hud` -- `.overlay` is `pointer-events: none`
 * and only restores it on immediate children, so nesting this deeper makes it
 * silently unclickable with no error to explain why.
 */
export function VerifyPayouts() {
  // Deliberately rendered in both states rather than hidden on a local chain:
  // a control that vanishes in development can't be designed against, and the
  // note explains the absence better than the absence does.
  if (!EXPLORER_ON) {
    return (
      <div className="panel verify verify-off" aria-disabled="true">
        <span className="panel-band band-chance">Verify payouts</span>
        <span className="verify-note">Live on devnet — a local chain isn&apos;t on Solscan</span>
      </div>
    );
  }

  return (
    <a
      className="panel verify"
      href={solscanAccount(TREASURY, CLUSTER)}
      target="_blank"
      rel="noreferrer"
    >
      <span className="panel-band band-chance">
        Verify payouts <span aria-hidden>↗</span>
      </span>
      {/* Names what the player is about to look at. Without it they land on a
          raw account page and have to work out what they're seeing. */}
      <span className="verify-note">Every prize ever paid, from the game&apos;s vault</span>
    </a>
  );
}
