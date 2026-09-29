import { clusterFromRpcUrl, explorerAvailable } from "@monopoly-sol/shared/explorer";
import { GATE_MINT, RPC_URL } from "./env";

/**
 * Everything the UI needs to build an explorer link, resolved once.
 *
 * Derived from the RPC endpoint rather than its own env var, so a link can
 * never point at a different chain than the one the app is talking to. That
 * mattered enough to centralise: two components each working out "which
 * cluster are we on" is exactly how they drift apart, and a link to the wrong
 * cluster looks like a missing payout.
 */
export const CLUSTER = clusterFromRpcUrl(RPC_URL);

/** False on a local validator, whose transactions exist on one machine only
 * and which Solscan therefore can never resolve. */
export const EXPLORER_ON = explorerAvailable(CLUSTER);

/** The mint a player must hold, or null when the gate is off. */
export const GATE_MINT_ADDRESS = GATE_MINT ? GATE_MINT.toBase58() : null;
