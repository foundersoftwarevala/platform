import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The short-lived pass that lets a visitor open one demo.
 *
 * Demos are the catalogue's only public thread: the products are hosted
 * elsewhere and the live URL is the only source detail to protect. The server
 * issues a scoped pass only after checking the product and active demo.
 *
 * The pass is signed and bound to the exact product, demo, category, and
 * persisted visitor session. The hosted demo address never appears in it.
 */

/** The cookie the proxy reads for one product-and-session asset path. */
export const DEMO_COOKIE = "sv_demo_pass";

export function demoCookiePath(slug: string, sessionId: string): string {
  return `/api/proxy/demo/${encodeURIComponent(slug)}/${encodeURIComponent(sessionId)}`;
}

export type DemoTicket = {
  slug: string;
  sessionId: string;
  demoId: string;
  categoryId: string;
  expiresAt: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  const value =
    process.env.DEMO_TICKET_SECRET?.trim() || process.env.INTERNAL_API_TOKEN?.trim() || "";
  return value || null;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Issue a pass for one product to one visitor.
 * Returns null on a server with no secret configured, so a misconfigured
 * deployment refuses demos rather than handing them out unsigned.
 */
export function issueDemoTicket(
  slug: string,
  sessionId: string,
  demoId: string,
  categoryId: string,
): string | null {
  const key = secret();
  if (!key || !slug || !UUID.test(sessionId) || !UUID.test(demoId) || !UUID.test(categoryId)) {
    return null;
  }
  const payload = encode(
    JSON.stringify({
      slug,
      sessionId,
      demoId,
      categoryId,
      expiresAt: Date.now() + 30 * 60 * 1000,
    } satisfies DemoTicket),
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
    if (
      !parsed?.slug ||
      !UUID.test(parsed.sessionId) ||
      !UUID.test(parsed.demoId) ||
      !UUID.test(parsed.categoryId)
    ) {
      return null;
    }
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The pass carried on a request, from the query string or the cookie. */
export function ticketFromRequest(
  request: Request,
  slug: string,
  sessionId?: string,
): DemoTicket | null {
  const fromQuery = new URL(request.url).searchParams.get("t");
  const direct = readDemoTicket(fromQuery);
  if (direct) {
    return direct.slug === slug && (!sessionId || direct.sessionId === sessionId) ? direct : null;
  }

  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DEMO_COOKIE) {
      // Signed tokens contain only base64url and a dot, so no URI decoding is needed.
      const pass = readDemoTicket(rest.join("="));
      if (pass?.slug === slug && (!sessionId || pass.sessionId === sessionId)) return pass;
    }
  }
  return null;
}
