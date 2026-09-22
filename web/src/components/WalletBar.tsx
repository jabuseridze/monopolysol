"use client";

import { useEffect, useRef } from "react";
import { useIdentity, useWatch } from "@/hooks/useIdentity";

const short = (a: string) => `${a.slice(0, 4)}..${a.slice(-4)}`;

/**
 * Who you are playing as.
 *
 * The address *form* used to live here too; it moved to the landing screen,
 * which is the only place it can be reached now. This is display plus an exit:
 * "Change" clears the stored address, which sends the player back to the door
 * rather than opening a second, competing input in the corner.
 *
 * It also used to show a SOL balance and a faucet button, and both were wrong:
 * players need no SOL at all -- the coordinator signs and funds every pick --
 * so the balance advertised a requirement that does not exist, and the faucet
 * only ever worked on devnet. Removing them also took a 30-second per-browser
 * RPC poll off the endpoint the coordinator depends on.
 */
export function WalletBar() {
  const { address } = useIdentity();
  const { setWatched } = useWatch();
  const ref = useRef<HTMLDivElement>(null);

  // The rules button sits directly beneath this panel and its height varies
  // with content, so a hardcoded offset collided with it. Publishing the
  // measured height lets `rules.css` place itself in `calc()`.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--wallet-bar-h",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // `page.tsx` only mounts the game once an address exists, so this is
  // defensive rather than a state a player can reach.
  if (!address) return null;

  return (
    <div
      ref={ref}
      className="panel wallet-bar"
      style={{ position: "absolute", top: 16, right: 16 }}
    >
      <div className="panel-band band-good">Your wallet</div>
      <div className="panel-body wallet-body">
      <div className="watch-row">
        <span className="watch-badge">PLAYING AS</span>
        <span className="mono watch-addr">{short(address)}</span>
        <button className="btn ghost watch-clear" onClick={() => setWatched(null)}>
          Change
        </button>
      </div>
      </div>
    </div>
  );
}
