/**
 * The browser side of marketplace activity tracking.
 *
 * /api/marketplace/track has existed with its rate limit, bot filter and
 * per-minute de-duplication, and nothing on the storefront ever called it - so
 * marketplace_events stopped at 8 September, the homepage activity feed and
 * "Popular now" ranked a frozen sample, and Product Analytics had no signal.
 * This is the caller.
 *
 * Deliberately fire-and-forget: it never throws, never blocks a click, and a
 * visitor never sees an error because analytics is unavailable. The session id
 * is random and kept for the tab only; nothing identifies the person unless
 * they are signed in, in which case the server takes their id from their own
 * token rather than from anything sent here.
 */

type TrackInput = {
  productId?: string | null;
  categoryId?: string | null;
  surface?: string;
  query?: string;
  position?: number;
};

const SESSION_KEY = "sv.track.session.v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

function campaign(): Record<string, string> {
  try {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const value = params.get(key);
      if (value) out[key] = value.slice(0, 120);
    }
    return out;
  } catch {
    return {};
  }
}

async function bearer(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function trackMarketplaceEvent(event: string, input: TrackInput = {}): void {
  if (typeof window === "undefined") return;
  const productId = input.productId && UUID_RE.test(input.productId) ? input.productId : undefined;
  const categoryId = input.categoryId && UUID_RE.test(input.categoryId) ? input.categoryId : undefined;
  void (async () => {
    try {
      const auth = await bearer();
      await fetch("/api/marketplace/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          event,
          ...(productId ? { productId } : {}),
          ...(categoryId ? { categoryId } : {}),
          sourcePage: window.location.pathname,
          ...(input.surface ? { surface: input.surface } : {}),
          ...(input.query ? { query: input.query.slice(0, 200) } : {}),
          ...(Number.isFinite(input.position) ? { position: input.position } : {}),
          sessionId: sessionId(),
          referrer: document.referrer ? document.referrer.slice(0, 300) : undefined,
          ...campaign(),
        }),
      });
    } catch {
      // Analytics never interrupts the visitor.
    }
  })();
}
