import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * The storefront chrome — the footer and the floating elements.
 *
 * Two audiences, deliberately separated.
 *
 * The public storefront reads one already-assembled snapshot per kind through
 * sf_config_live. Nothing about the draft is reachable from a browser: the
 * draft tables are operator-only, so an unpublished edit cannot leak onto the
 * site through a stray query, and the page never has to decide which of several
 * rows to believe.
 *
 * The manager reads and writes the draft as the signed-in person, so the
 * database decides what they may do rather than the screen deciding for it.
 */

/* ------------------------------------------------------------------ types */

export type FooterLink = {
  label: string;
  href: string | null;
  open_in_new: boolean;
  audience: "all" | "guest" | "authenticated";
};

export type FooterSnapshot = {
  published: boolean;
  show_footer?: boolean;
  newsletter?: {
    enabled: boolean;
    title: string;
    description: string | null;
    placeholder: string;
    consent: string | null;
    success: string;
  };
  columns?: { heading: string; links: FooterLink[] }[];
  socials?: { label: string; href: string; handle: string | null }[];
  trust?: { kind: string; name: string; alt: string; icon: string | null; href: string | null }[];
};

export type FloatingElement = {
  key: string;
  type: "ai_chat" | "support" | "request_demo" | "actions" | "link";
  label: string;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  offset_x: number;
  offset_y: number;
  theme: string;
  icon: string | null;
  priority: number;
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
  trigger: "immediate" | "delay" | "scroll" | "exit_intent";
  trigger_value: number;
  action: "route" | "external" | "whatsapp" | "mailto" | "tel" | "lead_form" | "none";
  target: string | null;
  audience: "all" | "guest" | "authenticated";
  scope: "all" | "home" | "marketplace" | "product" | "category";
};

export type FloatingSnapshot = { published: boolean; elements?: FloatingElement[] };

export type StorefrontOffer = {
  title: string;
  badge: string | null;
  code: string | null;
  href: string | null;
  ends_at: string | null;
};

export type StorefrontChrome = {
  footer: FooterSnapshot;
  floating: FloatingSnapshot;
  /** Offers the manager has published. Empty is the normal state. */
  offers: StorefrontOffer[];
  /** Published Vala TV videos. Empty means the section does not render. */
  videos: StorefrontVideo[];
};

export type StorefrontVideo = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  thumbnail: string | null;
  duration: string | null;
  category: string | null;
  featured: boolean;
  product_slug: string | null;
  /** Counted from recorded views. Null when nothing has been recorded. */
  views: number | null;
};

/* ------------------------------------------------------------- public read */

// The chrome changes when somebody publishes, not between requests, so it is
// held briefly rather than fetched for every visitor. Short enough that a
// manager sees their own publish without waiting.
const CACHE_MS = 30_000;
let cached: { at: number; payload: StorefrontChrome } | null = null;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Published Vala TV videos. Empty on any failure. */
async function liveVideos(): Promise<unknown[]> {
  const base = url();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/rest/v1/rpc/sf_vala_tv`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Published, in-window, non-seed offers. Empty on any failure. */
async function liveOffers(): Promise<unknown[]> {
  const base = url();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/rest/v1/rpc/sf_active_offers`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function liveConfig(kind: "footer" | "floating"): Promise<Record<string, unknown>> {
  const base = url();
  if (!base) return { published: false };
  try {
    const res = await fetch(`${base}/rest/v1/rpc/sf_config_live`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind }),
    });
    if (!res.ok) return { published: false };
    const data = (await res.json()) as Record<string, unknown>;
    return data && typeof data === "object" ? data : { published: false };
  } catch {
    // `published: false` is the storefront's instruction to fall back to what
    // it ships with. It is never confused with "everything is switched off".
    return { published: false };
  }
}

/**
 * What the public storefront renders.
 *
 * Both lookups are settled independently: a failed floating read must not cost
 * the page its footer, and a failed footer read must not stop a widget.
 */
export const getStorefrontChrome = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorefrontChrome> => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) return cached.payload;

    const [footer, floating, offers, videos] = await Promise.allSettled([
      liveConfig("footer"),
      liveConfig("floating"),
      liveOffers(),
      liveVideos(),
    ]);

    const payload: StorefrontChrome = {
      footer: (footer.status === "fulfilled"
        ? footer.value
        : { published: false }) as FooterSnapshot,
      floating: (floating.status === "fulfilled"
        ? floating.value
        : { published: false }) as FloatingSnapshot,
      // No published offer is the normal state, and it simply means the banner
      // shows the standing partner programmes on their own.
      offers: (offers.status === "fulfilled" ? offers.value : []) as StorefrontOffer[],
      // Empty is the normal state and means the Vala TV section does not render.
      videos: (videos.status === "fulfilled" ? videos.value : []) as StorefrontVideo[],
    };
    cached = { at: now, payload };
    return payload;
  },
);

/* ------------------------------------------------------------ manager side */

/**
 * Calls made as the signed-in person, never with the service key.
 *
 * Using the service role here would make every caller an operator, which is
 * exactly the mistake that let mm_is_operator pass for everybody.
 */
async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type Outcome = { ok?: boolean; reason?: string; message?: string; [k: string]: unknown };

/** Turn a refusal into a sentence the manager can act on. */
function settle(result: Outcome | null, whenOk: string) {
  if (!result?.ok) {
    throw new Error(
      result?.reason === "not_permitted"
        ? "Changing the storefront chrome needs marketplace operator rights."
        : String(result?.message ?? result?.reason ?? "The change was refused."),
    );
  }
  return { ...result, ok: true as const, message: whenOk };
}

const KIND = z.enum(["footer", "floating"]);

export const getChromeDraft = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ kind: KIND }).parse(i))
  .handler(async ({ data }) =>
    callAsUser<Record<string, unknown>>("sf_config_draft", { p_kind: data.kind }),
  );

export const validateChrome = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ kind: KIND }).parse(i))
  .handler(async ({ data }) =>
    callAsUser<{
      ok: boolean;
      errors: number;
      warnings: number;
      problems: { severity: string; item: string; message: string }[];
    }>("sf_validate", { p_kind: data.kind }),
  );

export const publishChrome = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ kind: KIND, note: z.string().max(400).optional() }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_publish", { p_kind: data.kind, p_note: data.note ?? null }),
      "Published",
    ),
  );

export const rollbackChrome = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ kind: KIND, version: z.number().int().min(1) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_rollback", { p_kind: data.kind, p_version: data.version }),
      "Rolled back",
    ),
  );

export const listChromeVersions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ kind: KIND }).parse(i))
  .handler(async ({ data }) =>
    callAsUser<{
      ok: boolean;
      versions: {
        version: number;
        is_live: boolean;
        note: string | null;
        published_at: string;
        published_by: string | null;
      }[];
    }>("sf_versions", { p_kind: data.kind, p_limit: 20 }),
  );

/* ----------------------------------------------------------- footer writes */

export const saveFooterLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ patch: z.record(z.string(), z.unknown()) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(await callAsUser<Outcome>("sf_footer_link_save", { p_patch: data.patch }), "Link saved"),
  );

export const removeFooterLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), hard: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_footer_link_remove", {
        p_id: data.id,
        p_hard: data.hard ?? false,
      }),
      data.hard ? "Link deleted" : "Link disabled",
    ),
  );

export const reorderFooterLinks = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      columnId: z.string().uuid(),
      ids: z.array(z.string().uuid()).min(1).max(60),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_footer_links_reorder", {
        p_column_id: data.columnId,
        p_ids: data.ids,
      }),
      "Order saved",
    ),
  );

export const saveSocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ patch: z.record(z.string(), z.unknown()) }).parse(i))
  .handler(async ({ data }) =>
    settle(await callAsUser<Outcome>("sf_social_save", { p_patch: data.patch }), "Profile saved"),
  );

export const saveTrustItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ patch: z.record(z.string(), z.unknown()) }).parse(i))
  .handler(async ({ data }) =>
    settle(await callAsUser<Outcome>("sf_trust_save", { p_patch: data.patch }), "Trust item saved"),
  );

export const saveFooterSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ patch: z.record(z.string(), z.unknown()) }).parse(i))
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_footer_settings_save", { p_patch: data.patch }),
      "Settings saved",
    ),
  );

/* --------------------------------------------------------- floating writes */

export const saveFloatingElement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1).max(80),
      patch: z.record(z.string(), z.unknown()),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("sf_floating_save", { p_key: data.key, p_patch: data.patch }),
      "Element saved",
    ),
  );
