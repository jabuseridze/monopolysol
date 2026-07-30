import { u64le } from "./pdas.js";

/** base58 of a u64 little-endian value, for getProgramAccounts memcmp filters. */
export function bs58le(n: number | bigint): string {
  // @solana/web3.js re-exports bs58 via PublicKey; encode manually here to
  // avoid pulling in an extra dependency for one call site.
  return bs58encode(u64le(n));
}

// Minimal base58 encoder (Bitcoin alphabet).
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bs58encode(buf: Buffer): string {
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i]! << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = "";
  for (const b of buf) {
    if (b === 0) str += "1";
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]!];
  return str;
}
