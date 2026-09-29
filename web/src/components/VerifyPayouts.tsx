"use client";

import { solscanAccount } from "@monopoly-sol/shared/explorer";
import { useGame } from "@/hooks/useGame";
import { CLUSTER, EXPLORER_ON } from "@/lib/explorerLinks";

/**
 * A standing invitation to check that the house actually pays.
 *
 * The results modal already links to the treasury, but only after a round with
 * a winner and only for three seconds -- so a player who hasn't won yet, or who
 * looked away, has no way to verify anything. For a game asking people to buy a
 * token first, "can I see that payouts are real?" needs an answer that is
 * always on screen, not one that flashes past.
 *
 * The address comes from live round state rather than the client's own env.
 * It is the wallet prizes are actually sent from, and only the server knows
 * which that is -- a `NEXT_PUBLIC_*` copy would be frozen at build time and
 * keep pointing at the old wallet until someone redeployed the frontend,
 * showing players a page with none of their payouts on it.
 *
 * Must be rendered directly from `Hud` -- `.overlay` is `pointer-events: none`
 * and only restores it on immediate children, so nesting this deeper makes it
 * silently unclickable with no error to explain why.
 */
export function VerifyPayouts() {
  const { round } = useGame();
  const wallet = round?.payoutWallet ?? null;

  // Deliberately rendered in both states rather than hidden on a local chain:
  // a control that vanishes in development can't be designed against, and the
  // note explains the absence better than the absence does.
  if (!EXPLORER_ON || !wallet) {
    return (
      <div className="panel verify verify-off" aria-disabled="true">
        <span className="panel-band band-chance">Verify payouts</span>
        <span className="verify-note">
          {EXPLORER_ON ? "Connecting…" : "Live on devnet — a local chain isn't on Solscan"}
        </span>
      </div>
    );
  }

  return (
    <a
      className="panel verify"
      href={solscanAccount(wallet, CLUSTER)}
      target="_blank"
      rel="noreferrer"
    >
      <span className="panel-band band-chance">
        Verify payouts <span aria-hidden>↗</span>
      </span>
      {/* Names what the player is about to look at. Without it they land on a
          raw account page and have to work out what they're seeing. */}
      <span className="verify-note">Every prize ever paid, from the game&apos;s wallet</span>
    </a>
  );
}
