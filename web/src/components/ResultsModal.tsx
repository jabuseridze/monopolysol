"use client";

import { useEffect, useState } from "react";
import { getTile, lamportsToSol } from "@monopoly-sol/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/hooks/useGame";
import { Confetti } from "./Confetti";

export function ResultsModal() {
  const { settled } = useGame();
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!settled) return;
    setOpen(true);
    const id = setTimeout(() => setOpen(false), 9000);
    return () => clearTimeout(id);
  }, [settled?.at]);

  if (!open || !settled) return null;

  const tile = getTile(settled.winningTile);
  const youWon = publicKey ? settled.winners.includes(publicKey.toBase58()) : false;
  const share = lamportsToSol(settled.shareLamports);

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(4,7,18,0.45)" }}>
      {youWon && <Confetti />}
      <div className="panel" style={{ padding: 26, width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
          Round #{settled.roundId} result
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", margin: "6px 0" }}>
          {tile?.name ?? `Tile ${settled.winningTile}`}
        </div>
        {settled.winners.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No winners - prize rolls into the next round.</div>
        ) : (
          <div style={{ fontSize: 15 }}>
            {settled.winners.length} winner{settled.winners.length > 1 ? "s" : ""} split{" "}
            <span className="mono" style={{ fontWeight: 700 }}>{lamportsToSol(settled.prizeLamports).toFixed(2)} SOL</span>
            <div style={{ marginTop: 6 }}>
              <span className="mono">{share.toFixed(4)} SOL</span> each
            </div>
          </div>
        )}
        {youWon && (
          <div style={{ marginTop: 12, color: "var(--good)", fontWeight: 800, fontSize: 18 }}>
            You won! Payout sent.
          </div>
        )}
        {settled.txSignature && (
          <a
            href={`https://explorer.solana.com/tx/${settled.txSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 12, color: "#8ecae6", fontSize: 12 }}
          >
            View payout on Explorer
          </a>
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
