/**
 * Keys for translation memory.
 *
 * source_hash keeps the format rows were already written in (the first 32 hex
 * characters of SHA-256 over the trimmed text), so existing rows keep their
 * keys. context_hash covers the namespace and context the text appears in;
 * the migration computes the same value for rows that had none.
 */

const CONTEXT_SEPARATOR = "\u001f"; // must match chr(31) in the migration

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  // Web Crypto is global in every runtime this app supports (Node 20+,
  // Workers, browsers).
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sourceHash(text: string): Promise<string> {
  return (await sha256Hex(text.trim())).slice(0, 32);
}

export async function contextHash(
  namespace: string,
  context: string | null | undefined,
): Promise<string> {
  return (await sha256Hex(`${namespace}${CONTEXT_SEPARATOR}${context ?? ""}`)).slice(0, 32);
}
