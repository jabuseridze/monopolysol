"use client";

import { solscanAccount } from "@monopoly-sol/shared/explorer";
import type { TokenGate } from "@/hooks/useTokenGate";
import { CLUSTER, EXPLORER_ON, GATE_MINT_ADDRESS } from "@/lib/explorerLinks";

/**
 * The entry requirement, stated in the guess panel whether or not it is met.
 *
 * Split from `PickPanel` because that component is a switch over four mutually
 * exclusive states and this is a footnote that outlives all of them -- folding
 * it in would have meant repeating the same markup in three branches.
 *
 * The eligible case earns its place as much as the warning: a holder used to
 * get no confirmation at all, so "is my address actually working?" went
 * unanswered until they clicked a pad and something happened.
 */
export function GateNote({ gate, ready }: { gate: TokenGate; ready: boolean }) {
  // "the game token" is a link wherever an explorer can resolve it. Telling
  // someone they need a token without saying *which* token is a rule they
  // cannot act on -- this is what turns it into a call to action.
  const token =
    EXPLORER_ON && GATE_MINT_ADDRESS ? (
      <a
        className="gate-token"
        href={solscanAccount(GATE_MINT_ADDRESS, CLUSTER)}
        target="_blank"
        rel="noreferrer"
      >
        the game token ↗
      </a>
    ) : (
      "the game token"
    );

  if (!ready) {
    return <div className="gate-note">Requires holding {token} in that wallet.</div>;
  }
  if (gate.loading) {
    return <div className="gate-note">Checking your token balance…</div>;
  }
  return (
    <div className="gate-note gate-ok">
      <span aria-hidden>✓</span> Token held — you&apos;re eligible to guess.
    </div>
  );
}
