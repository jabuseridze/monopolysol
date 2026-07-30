import { Buffer } from "buffer";

// @solana/web3.js and the wallet adapters expect a global Buffer in the browser.
if (typeof window !== "undefined" && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}
