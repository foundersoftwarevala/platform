import { createHash, randomBytes } from "node:crypto";

export const now = () => new Date().toISOString();

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random id with a readable prefix, e.g. `T-7KQ2M9XH`. */
export function newId(prefix: string, length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}-${out}`;
}

/** An error whose message is safe to show the caller, with an HTTP status. */
export class ValaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function tail(text: string, max: number): string {
  return text.length <= max ? text : text.slice(text.length - max);
}
