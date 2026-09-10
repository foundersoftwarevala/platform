export type AuthUser = { id: string; email: string };
export type ResellerAccount = {
  id: string;
  user_id: string | null;
  name: string | null;
  code: string | null;
  email: string | null;
  status: string;
  kyc_status: string | null;
  tier: string | null;
  plan_code: string | null;
  company_name: string | null;
};

export function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function publishableKey(): string {
  return process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
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

export async function resellerForUser(userId: string): Promise<ResellerAccount | null> {
  const response = await rest(
    `resellers?select=id,user_id,name,code,email,status,kyc_status,tier,plan_code,company_name` +
      `&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as ResellerAccount[];
  return rows[0] ?? null;
}

export type ResellerContext =
  | { ok: true; user: AuthUser; reseller: ResellerAccount }
  | { ok: false; response: Response };

function deny(message: string, status: number): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error: message }, { status }) };
}

export async function requireReseller(
  request: Request,
  { allowPending = false } = {},
): Promise<ResellerContext> {
  if (!supabaseUrl() || !serviceKey()) {
    return deny("The reseller backend is not configured", 503);
  }
  const user = await currentUser(request);
  if (!user) return deny("Please sign in", 401);

  const reseller = await resellerForUser(user.id);
  if (!reseller) return deny("This account is not linked to a reseller profile", 403);
  if (["suspended", "terminated", "rejected"].includes(reseller.status)) {
    return deny("This reseller account is not active", 403);
  }
  if (reseller.status !== "active" && !allowPending) {
    return deny("This reseller account is awaiting approval", 403);
  }
  return { ok: true, user, reseller };
}
