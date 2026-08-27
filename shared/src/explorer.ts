/**
 * Links into a Solana block explorer, so players can check for themselves
 * that the prize actually moved.
 *
 * The cluster is a parameter, never a constant. The previous hardcoded
 * `?cluster=devnet` produced links that looked authoritative and were simply
 * wrong whenever the game ran against a local validator -- the worst failure
 * mode for a feature whose entire job is being trustworthy.
 */

/** Which chain the app is talking to. `localnet` is deliberately included so
 * callers can detect it and decline to render a link at all. */
export type Cluster = "mainnet-beta" | "devnet" | "testnet" | "localnet";

const SOLSCAN = "https://solscan.io";

/**
 * Infer the cluster from an RPC URL. Both the web app and the coordinator
 * already carry one, so this avoids a second env var that could disagree with
 * the endpoint actually in use.
 */
export function clusterFromRpcUrl(rpcUrl: string): Cluster {
  const u = rpcUrl.toLowerCase();
  if (u.includes("127.0.0.1") || u.includes("localhost")) return "localnet";
  if (u.includes("testnet")) return "testnet";
  if (u.includes("devnet")) return "devnet";
  return "mainnet-beta";
}

/**
 * Whether an explorer link is worth showing. Local validator transactions
 * exist only on the machine that produced them, so Solscan can never resolve
 * them -- linking anyway would just look broken.
 */
export function explorerAvailable(cluster: Cluster): boolean {
  return cluster !== "localnet";
}

function suffix(cluster: Cluster): string {
  // Solscan treats mainnet as the default and needs no parameter.
  return cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
}

/** Link to an account's page -- its full transaction history. */
export function solscanAccount(address: string, cluster: Cluster): string {
  return `${SOLSCAN}/account/${address}${suffix(cluster)}`;
}

/** Link to a single transaction. */
export function solscanTx(signature: string, cluster: Cluster): string {
  return `${SOLSCAN}/tx/${signature}${suffix(cluster)}`;
}
