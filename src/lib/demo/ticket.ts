import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pass that lets a signed-in visitor open a demo.
 *
 * Demos are the catalogue's only public thread: the products are hosted
 * elsewhere and the live URL is the whole of what there is to steal. So the
 * proxy must not serve a demo to whoever asks for it. A visitor signs in and is
 * verified, the server issues one of these, and the proxy accepts nothing else.
 *
 * The pass is signed rather than stored, so checking one costs no database
 * round trip; it names the single product it opens and expires on its own, so a
 * leaked pass opens one demo for a short while and nothing more. The demo's
 * real address never appears in it.
 */

const TTL_MS = 30 * 60 * 1000;

/** The cookie the proxy reads for the asset requests an iframe makes itself. */
export const DEMO_COOKIE = "sv_demo_pass";

export type DemoTicket = { slug: string; userId: string; expiresAt: number };

function secret(): string | null {
  const value =
    process.env.DEMO_TICKET_SECRET?.trim() ||
    process.env.INTERNAL_API_TOKEN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  return value || null;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Issue a pass for one product to one signed-in person.
 * Returns null on a server with no secret configured, so a misconfigured
 * deployment refuses demos rather than handing them out unsigned.
 */
export function issueDemoTicket(slug: string, userId: string): string | null {
  const key = secret();
  if (!key || !slug || !userId) return null;
  const payload = encode(
    JSON.stringify({ slug, userId, expiresAt: Date.now() + TTL_MS } satisfies DemoTicket),
  );
  return `${payload}.${sign(payload, key)}`;
}

/** Read a pass back, or null if it is unsigned, tampered with or expired. */
export function readDemoTicket(value: string | null | undefined): DemoTicket | null {
  const key = secret();
  if (!key || !value) return null;

  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const presented = value.slice(dot + 1);
  const expected = sign(payload, key);

  // Compare in constant time, and only when the lengths already match -
  // timingSafeEqual throws on a length mismatch.
  if (presented.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(presented), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DemoTicket;
    if (!parsed?.slug || !parsed?.userId) return null;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The pass carried on a request, from the query string or the cookie. */
export function ticketFromRequest(request: Request): DemoTicket | null {
  const fromQuery = new URL(request.url).searchParams.get("t");
  const direct = readDemoTicket(fromQuery);
  if (direct) return direct;

  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DEMO_COOKIE) return readDemoTicket(decodeURIComponent(rest.join("=")));
  }
  return null;
}
