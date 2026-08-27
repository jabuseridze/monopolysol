import { Connection } from "@solana/web3.js";
import { RPC_URL } from "./env";

/**
 * The app's single read-only RPC connection.
 *
 * This replaced `@solana/wallet-adapter-react`'s `ConnectionProvider`, which
 * came bundled with the wallet-connection machinery the game no longer has --
 * players paste an address rather than connecting, so nothing in the client
 * ever signs or sends a transaction. Everything here is a balance read.
 *
 * Module-level rather than a React context: it holds no state worth
 * re-rendering on, and a single instance means the connection pool is shared
 * across every hook that reads the chain.
 */
export const connection = new Connection(RPC_URL, "confirmed");
