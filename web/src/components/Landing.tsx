"use client";

import { useState } from "react";
import { solscanAccount } from "@monopoly-sol/shared/explorer";
import { useWatch } from "@/hooks/useIdentity";
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
/**
 * The name, curved into the banner painted across the hero art.
 *
 * The `viewBox` is the hero image's own 1024x572, and the SVG is stretched over
 * `.landing-hero` -- which is itself sized to exactly that aspect ratio. So one
 * SVG user unit is one image pixel at every window size, and the path
 * coordinates below could be read straight off the artwork. Nothing here can
 * drift off the sign as the window changes, which a viewport-relative position
 * could not promise.
 *
 * `<textPath>` rather than rotating letters individually: the plaque's rails
 * bow away from centre (top rises ~33px mid-span, bottom drops ~23px), and
 * per-letter rotation approximates that curve while destroying kerning.
 */
function Wordmark() {
  // Sits inside the plaque's interior and follows the top rail's rise.
  // Solved against the artwork, not eyeballed. The outer letters have to centre
  // on the painted laurels (measured at y 141.5 left, 142 right) while the apex
  // stays put, so with the apex pinned -- P1y = 2*apex - Ye -- the baseline
  // where the glyphs begin collapses to one unknown:
  //
  //     y(start) = 0.7396 * Ye + 0.2604 * apex
  //
  // The 0.07..0.93 span is where the glyphs actually sit on the path, not its
  // full length. Raising the ends WITHOUT that substitution does not work: the
  // control point compensates and swallows half the movement, which cost an
  // iteration. This arc is gentler than the frame's own rails (~17 units of
  // rise against ~37); aligning to the laurels and tracing the rails pull
  // slightly apart, and the laurels win because they are what the eye pairs
  // the letters with.
  const BASELINE = "M 252 168 Q 516 120 780 168";
  return (
    <svg className="landing-wordmark" viewBox="0 0 1024 572" aria-hidden focusable="false">
      <defs>
        <path id="wordmark-arc" d={BASELINE} />
        <linearGradient
          id="sol-gradient"
          gradientUnits="userSpaceOnUse"
          x1="626" y1="92" x2="748" y2="164"
        >
          <stop offset="5%" stopColor="#9945ff" />
          <stop offset="52%" stopColor="#19d3f5" />
          <stop offset="95%" stopColor="#14f195" />
        </linearGradient>
      </defs>

      {/* SVG has no text-shadow, so the bevel is a second copy of the same text
          on the same path, nudged down and filled gold. */}
      <text className="wm-text wm-bevel" dy="2.5">
        <textPath href="#wordmark-arc" startOffset="50%" textAnchor="middle">
          MONOPOLY<tspan className="wm-gem"> ◆ </tspan>SOL
        </textPath>
      </text>
      <text className="wm-text">
        <textPath href="#wordmark-arc" startOffset="50%" textAnchor="middle">
          <tspan className="wm-main">MONOPOLY</tspan>
          <tspan className="wm-gem"> ◆ </tspan>
          <tspan className="wm-sol">SOL</tspan>
        </textPath>
      </text>
    </svg>
  );
}

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
          <Wordmark />
        </div>
        <div className="landing-scrim" />
      </div>

      {/* Narrow screens crop the artwork to the plaque's empty interior, and
          the curved wordmark is hidden there because the sign runs off-frame --
          which left the whole top half blank and unbranded. This flat copy
          fills that gap; it is the same name, just without the arc it has no
          room for. */}
      <div className="landing-wordmark-sm" aria-hidden>
        MONOPOLY<span className="wm-sm-gem">◆</span><span className="wm-sm-sol">SOL</span>
      </div>

      <div className="panel landing-card">
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

        {/* Three promises at a glance rather than three sentences. The card
            sits in front of artwork that is doing most of the persuading, so
            the copy's job is to be scannable, not complete. The token link
            survives because holding the coin is the one prerequisite a
            newcomer has to act on. */}
        <ul className="landing-points">
          <li>No wallet</li>
          <li>
            {tokenLink ? (
              <a href={tokenLink} target="_blank" rel="noreferrer" className="landing-link">
                Holders only ↗
              </a>
            ) : (
              "Holders only"
            )}
          </li>
          <li>Paid instantly</li>
        </ul>
        </div>
      </div>
    </main>
  );
}
