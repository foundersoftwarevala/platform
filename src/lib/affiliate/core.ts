/**
 * Affiliate core: identity, referral codes and attribution.
 *
 * The database already carried the whole referral chain and no code touched it:
 *
 *   marketplace_affiliate_partners  who the affiliate is
 *   marketplace_referral_codes      their links
 *   marketplace_referral_sessions   a visitor's session against a code
 *   marketplace_order_attributions  which affiliate an order belongs to
 *
 * The only referral link in the product was `?ref=${role.key}` on a clipboard
 * button — the role name, not the person — and nothing read the parameter. So
 * every affiliate shared an identical link that tracked nothing.
 *
 * Attribution model: last eligible click inside a sixty-day window. Sixty days
 * is not a choice made here — it is the window quoted in the Affiliate
 * Agreement a partner accepts when applying ("10-25% commission, 60 day cookie
 * window"), in lib/applications/config.ts.
 *
 * Attribution is resolved on the server from the stored session, never from
 * anything the browser sends at checkout.
 */

/** The attribution window, from the Affiliate Agreement. */
export const ATTRIBUTION_WINDOW_DAYS = 60;

/** Name of the first-party cookie that carries the visitor's session key. */
export const REFERRAL_COOKIE = "sv_ref";

export type AffiliatePartner = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  status: string;
  created_at: string;
};

export function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function publishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ""
  );
}

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

export async function currentUser(request: Request): Promise<{ id: string; email: string } | null> {
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

export async function partnerForUser(userId: string): Promise<AffiliatePartner | null> {
  const response = await rest(
    `marketplace_affiliate_partners?select=id,user_id,display_name,status,created_at` +
      `&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as AffiliatePartner[];
  return rows[0] ?? null;
}

export type AffiliateContext =
  | { ok: true; user: { id: string; email: string }; partner: AffiliatePartner }
  | { ok: false; response: Response };

function deny(message: string, status: number) {
  return { ok: false as const, response: Response.json({ error: message }, { status }) };
}

export async function requireAffiliate(
  request: Request,
  { allowPending = false } = {},
): Promise<AffiliateContext> {
  if (!supabaseUrl() || !serviceKey()) {
    return deny("The marketplace backend is not configured", 503);
  }
  const user = await currentUser(request);
  if (!user) return deny("Please sign in", 401);

  const partner = await partnerForUser(user.id);
  if (!partner) return deny("This account is not enrolled in the affiliate programme", 403);
  if (partner.status === "suspended" || partner.status === "terminated") {
    return deny("This affiliate account is not active", 403);
  }
  if (partner.status !== "approved" && !allowPending) {
    return deny("This affiliate account is awaiting approval", 403);
  }
  return { ok: true, user, partner };
}

/* ------------------------------------------------------------------ */
/* Referral codes                                                      */
/* ------------------------------------------------------------------ */

// No vowels and no look-alike characters, so a code read aloud or copied from a
// video cannot be mistyped into someone else's code.
const CODE_ALPHABET = "23456789BCDFGHJKLMNPQRSTVWXYZ";

function randomCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * A referral code that is not already taken. Uniqueness is enforced by the
 * database; this retries on collision rather than assuming a random string is
 * free, because two affiliates generating at the same moment is exactly the
 * case a "probably unique" code gets wrong.
 */
export async function generateUniqueCode(prefix = "SV"): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${prefix}${randomCode(8)}`;
    const existing = await rest(
      `marketplace_referral_codes?select=id&code=eq.${encodeURIComponent(candidate)}&limit=1`,
    );
    if (!existing.ok) return null;
    if (((await existing.json()) as unknown[]).length === 0) return candidate;
  }
  return null;
}

/** A referral code row, resolved for tracking. Only active codes attribute. */
export async function resolveCode(code: string): Promise<
  {
    id: string; code: string;
    affiliate_partner_id: string | null;
    influencer_profile_id: string | null;
    reseller_id: string | null;
  } | null
> {
  const clean = code.trim().toUpperCase().slice(0, 64);
  if (!clean) return null;
  const response = await rest(
    `marketplace_referral_codes?select=id,code,affiliate_partner_id,influencer_profile_id,reseller_id` +
      `&code=eq.${encodeURIComponent(clean)}&active=is.true&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as {
    id: string; code: string;
    affiliate_partner_id: string | null;
    influencer_profile_id: string | null;
    reseller_id: string | null;
  }[];
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

/** A session key that identifies a browser without identifying a person. */
export function newSessionKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * First-party, HttpOnly, SameSite=Lax. HttpOnly matters: the session key is what
 * decides who gets paid, so script on the page must not be able to read or
 * forge it. Lax still allows the cookie on a normal top-level navigation from
 * a social post, which is exactly how an affiliate link is used.
 */
export function referralCookie(sessionKey: string): string {
  const maxAge = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60;
  return [
    `${REFERRAL_COOKIE}=${encodeURIComponent(sessionKey)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

export type ResolvedAttribution = {
  sessionId: string;
  referralCodeId: string | null;
  affiliatePartnerId: string | null;
  influencerProfileId: string | null;
  resellerId: string | null;
  method: string;
  firstSeenAt: string;
};

/**
 * The attribution for a session key, if it is still inside the window.
 *
 * Returns null for a session that has expired rather than paying on a click
 * from six months ago. The window is measured from the last time the visitor
 * was seen on that link, which is the "last eligible click" model.
 */
export async function attributionForSession(sessionKey: string): Promise<ResolvedAttribution | null> {
  if (!sessionKey) return null;
  const response = await rest(
    `marketplace_referral_sessions?select=id,referral_code_id,affiliate_partner_id,influencer_profile_id,reseller_id,first_seen_at,last_seen_at` +
      `&session_key=eq.${encodeURIComponent(sessionKey)}&order=last_seen_at.desc&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as {
    id: string; referral_code_id: string | null; affiliate_partner_id: string | null;
    influencer_profile_id: string | null; reseller_id: string | null;
    first_seen_at: string; last_seen_at: string;
  }[];
  const session = rows[0];
  if (!session) return null;

  const lastSeen = new Date(session.last_seen_at ?? session.first_seen_at).getTime();
  const ageDays = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(ageDays) || ageDays > ATTRIBUTION_WINDOW_DAYS) return null;

  return {
    sessionId: session.id,
    referralCodeId: session.referral_code_id,
    affiliatePartnerId: session.affiliate_partner_id,
    influencerProfileId: session.influencer_profile_id,
    resellerId: session.reseller_id,
    // The database constrains this column to its own vocabulary; `referral_code`
    // is the value that means "attributed through a referral code". The window
    // that made it eligible is recorded alongside it, on the attribution row.
    method: "referral_code",
    firstSeenAt: session.first_seen_at,
  };
}

/**
 * Record which affiliate an order belongs to.
 *
 * Written once per order. An order that already carries an attribution keeps
 * it: re-running settlement, or a duplicate webhook, must never move a sale
 * from one affiliate to another.
 */
export async function attributeOrder(
  orderId: string,
  attribution: ResolvedAttribution,
  metadata: Record<string, unknown> = {},
): Promise<{ created: boolean; reason?: string }> {
  const existing = await rest(
    `marketplace_order_attributions?select=id&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  if (existing.ok && ((await existing.json()) as unknown[]).length > 0) {
    return { created: false, reason: "already attributed" };
  }

  const insert = await rest("marketplace_order_attributions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      order_id: orderId,
      session_id: attribution.sessionId,
      referral_code_id: attribution.referralCodeId,
      affiliate_partner_id: attribution.affiliatePartnerId,
      influencer_profile_id: attribution.influencerProfileId,
      reseller_id: attribution.resellerId,
      attribution_method: attribution.method,
      attributed_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        first_seen_at: attribution.firstSeenAt,
        attribution_model: `last-click-${ATTRIBUTION_WINDOW_DAYS}d`,
        attribution_window_days: ATTRIBUTION_WINDOW_DAYS,
      },
    }),
  });
  if (!insert.ok && insert.status !== 409) {
    return { created: false, reason: `insert failed (${insert.status})` };
  }

  // Mark the session as converted so a second order cannot claim the same click.
  await rest(`marketplace_referral_sessions?id=eq.${encodeURIComponent(attribution.sessionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ converted_order_id: orderId }),
  });

  return { created: true };
}
