/**
 * Server-side identity for the author (seller) surfaces.
 *
 * Every author endpoint has to answer two questions before it does anything:
 * who is calling, and which seller record do they own. Both answers come from
 * the database — the caller's bearer token is verified against Supabase Auth,
 * and the seller is looked up by `owner_user_id`. Nothing is taken from the
 * request body, so an author cannot act as another by sending a different id.
 *
 * The service-role key is used for the actual reads and writes because the
 * author-facing RLS policies are applied separately; the authorization that
 * matters is done here, explicitly, on every call.
 */

export type AuthUser = { id: string; email: string };
export type Seller = {
  id: string;
  owner_user_id: string;
  display_name: string | null;
  slug: string | null;
  status: string;
  payout_currency: string | null;
};

export function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function publishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ""
  );
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

/** Service-role REST call. Callers must have already checked authorization. */
export async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = serviceKey();
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/**
 * The signed-in user, proven by asking Supabase Auth to resolve the bearer
 * token. A forged or expired token resolves to null.
 */
export async function currentUser(request: Request): Promise<AuthUser | null> {
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl() || !publishableKey() || !authorization) return null;
  try {
    const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
      headers: { apikey: publishableKey(), Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    return user?.id ? { id: user.id, email: user.email ?? "" } : null;
  } catch {
    return null;
  }
}

/** The seller record this user owns, whatever its status. */
export async function sellerForUser(userId: string): Promise<Seller | null> {
  const response = await rest(
    `marketplace_sellers?select=id,owner_user_id,display_name,slug,status,payout_currency` +
      `&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Seller[];
  return rows[0] ?? null;
}

export type AuthorContext =
  | { ok: true; user: AuthUser; seller: Seller }
  | { ok: false; response: Response };

function deny(message: string, status: number): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error: message }, { status }) };
}

/**
 * Resolve the calling author, refusing anyone who is not signed in, is not a
 * seller, or whose seller record is not approved yet. An author whose
 * application is still pending can see that state but cannot publish.
 */
export async function requireAuthor(
  request: Request,
  { allowPending = false } = {},
): Promise<AuthorContext> {
  if (!supabaseUrl() || !serviceKey()) {
    return deny("The marketplace backend is not configured", 503);
  }
  const user = await currentUser(request);
  if (!user) return deny("Please sign in", 401);

  const seller = await sellerForUser(user.id);
  if (!seller) {
    return deny("This account is not registered as an author on the marketplace", 403);
  }
  if (seller.status === "suspended") {
    return deny("This author account is suspended", 403);
  }
  if (seller.status !== "approved" && !allowPending) {
    return deny("This author account is awaiting approval", 403);
  }
  return { ok: true, user, seller };
}

/** Confirm a product belongs to this seller. Ownership is read, never supplied. */
export async function ownsProduct(sellerId: string, productId: string): Promise<boolean> {
  const response = await rest(
    `marketplace_products?select=id&id=eq.${encodeURIComponent(productId)}` +
      `&seller_id=eq.${encodeURIComponent(sellerId)}&limit=1`,
  );
  if (!response.ok) return false;
  return ((await response.json()) as unknown[]).length > 0;
}

/**
 * The product lifecycle, and who may move it.
 *
 * An author may take a product from draft to submitted and back to draft while
 * it is theirs to edit. Everything from review onwards belongs to Software
 * Vala — an author must never be able to approve or publish their own work.
 */
export const AUTHOR_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["draft"],
  changes_requested: ["submitted", "draft"],
  rejected: ["draft"],
};

export const REVIEW_TRANSITIONS: Record<string, string[]> = {
  submitted: ["under_review", "approved", "rejected", "changes_requested"],
  under_review: ["approved", "rejected", "changes_requested"],
  approved: ["published", "suspended", "rejected"],
  published: ["suspended", "archived"],
  suspended: ["published", "archived"],
  changes_requested: ["under_review", "rejected"],
  rejected: ["under_review"],
  archived: [],
  draft: ["under_review", "rejected"],
};

/** Fields an author is allowed to set on their own product. */
export const AUTHOR_EDITABLE = [
  "name", "slug", "description", "features", "tech_stack", "technology",
  "frontend", "backend", "database", "mobile", "cloud", "integrations",
  "demo_url", "public_repo_url", "documentation", "thumbnail_url", "cover_image",
  "logo", "icon", "favicon", "tags", "search_keywords", "languages", "industry_label",
  "target_audience", "subcategory", "category_id", "software_type", "modules",
  "benefits", "roles", "version", "price_label", "price_period", "currency",
] as const;

/**
 * Strip anything the author is not allowed to set. Approval state, visibility,
 * ownership, ratings and sales counters are the platform's, and silently
 * dropping them is safer than trusting a client not to send them.
 */
export function pickAuthorFields(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of AUTHOR_EDITABLE) {
    if (key in input && input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

/** A URL-safe slug derived from a name, so two authors cannot collide by accident. */
export function slugify(value: string, suffix: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return (base || "product") + "-" + suffix;
}
