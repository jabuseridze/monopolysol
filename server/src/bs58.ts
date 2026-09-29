const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Decode a secret key in either form a key actually arrives in.
 *
 * The Solana CLI writes `[12,34,...]`; every browser wallet exports base58.
 * Only the first used to be accepted, and pasting the other failed with
 * `SyntaxError: Unexpected token 'j'` from inside `JSON.parse` -- an error
 * that names neither keys nor formats, and which cost a real debugging
 * session to trace back to a paste.
 */
export function decodeSecretKey(raw: string): Uint8Array {
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58decode(raw);
  if (bytes.length !== 64) {
    throw new Error(
      `Expected a 64-byte secret key, got ${bytes.length} bytes. ` +
        `A 32-byte value is a PUBLIC key or a seed, not a keypair.`
    );
  }
  return bytes;
}

/** Minimal base58 decoder (Bitcoin alphabet). */
export function bs58decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of s) {
    const value = ALPHABET.indexOf(ch);
    if (value < 0) throw new Error(`Invalid base58 character '${ch}' in key`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Each leading '1' is a literal leading zero byte, not a digit.
  for (const ch of s) {
    if (ch === "1") bytes.push(0);
    else break;
  }
  return Uint8Array.from(bytes.reverse());
}
