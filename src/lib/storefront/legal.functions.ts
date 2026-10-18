import { createServerFn } from "@tanstack/react-start";

/**
 * The published legal pages, read on the server.
 *
 * legal_policies is an operator-and-reviewer table and stays that way - drafts,
 * compliance scores and review dates are not the public's business. The two
 * resolvers below are SECURITY DEFINER functions that return only what has
 * been published and only the fields a reader needs, which is the same shape
 * the rest of the storefront uses (sf_vala_tv, sf_active_offers, sf_config_live).
 *
 * Nothing here caches. A legal page changing is exactly the kind of change that
 * has to reach the reader immediately, and these are read once per page view.
 */

export type LegalSummary = {
  slug: string;
  name: string;
  policy_type: string;
  version: string;
  last_updated: string | null;
};

export type LegalPolicy = LegalSummary & {
  effective_from: string | null;
  content: string;
};

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
  const base = url();
  if (!base) return [];
  try {
    const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: admin(),
      body: JSON.stringify(body),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

/** Every published policy, for the index page and the footer. */
export const listLegalPolicies = createServerFn({ method: "GET" }).handler(
  async (): Promise<LegalSummary[]> => rpc<LegalSummary>("sf_legal_index", {}),
);

/** One published policy by its slug, or null when there is no such page. */
export const getLegalPolicy = createServerFn({ method: "GET" })
  .inputValidator((slug: unknown) => String(slug ?? "").slice(0, 120))
  .handler(async ({ data }): Promise<LegalPolicy | null> => {
    if (!data) return null;
    const rows = await rpc<LegalPolicy>("sf_legal_policy", { p_slug: data });
    return rows[0] ?? null;
  });
