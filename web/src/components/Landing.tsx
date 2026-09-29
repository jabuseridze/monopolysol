"use client";

import { useState } from "react";
import { solscanAccount } from "@monopoly-sol/shared/explorer";
import { useWatch } from "@/hooks/useIdentity";
import { BOARD_NAME } from "@/three/board/centrePlaque";
import { CLUSTER, EXPLORER_ON, GATE_MINT_ADDRESS } from "@/lib/explorerLinks";

/**
 * The way into the game: type an address, press Play.
 *
 * Entering through a door rather than landing mid-round is what makes the
 * "no wallet needed" promise land. Previously the board loaded first and the
 * address box was one control among six in a corner, so the single most
 * important instruction competed with a countdown, a mute button and a live
 * 3D scene.
 *
 * Deliberately pure DOM: no WebGL, no socket, no RPC. It renders on a machine
 * that cannot run the board at all, which is exactly where a player is most
 * likely to need to read what this game wants from them.
 */
export function Landing() {
  const { setWatched, error } = useWatch();
  const [draft, setDraft] = useState("");

  const tokenLink =
    EXPLORER_ON && GATE_MINT_ADDRESS ? solscanAccount(GATE_MINT_ADDRESS, CLUSTER) : null;

  return (
    <main className="landing">
      {/* The board's own art, blurred back into a backdrop. Reusing it keeps
          the door and the room unmistakably the same place, and costs nothing:
          the 3D scene loads this texture anyway, so it is already cached by the
          time the board appears. */}
      {/* The wordmark lives INSIDE `.landing-hero` so it inherits that
          element's box, which is what keeps it seated in the plaque painted
          into the art when the window is resized. */}
      <div className="landing-stage" aria-hidden>
        <div className="landing-hero">
          <div className="landing-wordmark">
            <span className="wordmark-main">MONOPOLY</span>
            <span className="wordmark-gem">◆</span>
            <span className="wordmark-sol">SOL</span>
          </div>
        </div>
        <div className="landing-scrim" />
      </div>

      <div className="panel landing-card">
        <div className="panel-band band-purple">{BOARD_NAME} · Solana</div>
        <div className="landing-body">
        <h1 className="landing-title">Guess the dice. Split the pot.</h1>
        <p className="landing-lede">
          Every round, two dice roll and an avatar walks the board. Guess the
          sum and you split the prize with everyone else who got it right.
        </p>

        <form
          className="landing-form"
          onSubmit={(e) => {
            e.preventDefault();
            setWatched(draft);
          }}
        >
          <label className="landing-label" htmlFor="landing-address">
            Your Solana wallet address
          </label>
          <input
            id="landing-address"
            className="landing-input mono"
            placeholder="Paste your wallet address"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          {error && <div className="landing-error">{error}</div>}
          <button className="btn landing-play" type="submit" disabled={draft.trim().length === 0}>
            Play
          </button>
        </form>

        <ul className="landing-points">
          <li>
            <strong>No wallet connection.</strong> Nothing to install, nothing to
            sign — just the address.
          </li>
          <li>
            <strong>Holders only.</strong> That address must hold{" "}
            {tokenLink ? (
              <a href={tokenLink} target="_blank" rel="noreferrer" className="landing-link">
                the game token ↗
              </a>
            ) : (
              "the game token"
            )}{" "}
            to guess.
          </li>
          <li>
            <strong>Prizes go straight to you.</strong> Winnings are sent to the
            address you type here, automatically.
          </li>
        </ul>

        {/* Says plainly what an address can and cannot do here, so nobody
            pastes one thinking it is a login they need to protect. */}
        <p className="landing-fineprint">
          Your address is public information — it is only used to check the
          token and to send winnings. It can&apos;t move your funds.
        </p>
        </div>
      </div>
    </main>
  );
}
