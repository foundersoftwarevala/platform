/**
 * The Marketplace Manager's own caller check, for the few server functions in
 * this folder that do not go through a gated mm_* RPC.
 *
 * Every other Marketplace Manager function calls the database as the signed-in
 * person, and the database refuses anyone public.mm_is_operator() does not
 * accept. The functions that read with the service role, or call an RPC that has
 * no gate of its own, ask the same question here - of the same function, with
 * the caller's own token - so they admit exactly the people the rest of the
 * console admits (the platform operators plus marketing and seo, which is also
 * what RouteAccessGate lets through the /marketplace-manager door) and nobody
 * else. requireOperator's list is a different one: it lets employee, sales,
 * support and finance in, none of whom this console serves, and keeps marketing
 * and seo out.
 *
 * PostgREST verifies the token's signature before the function runs, so a
 * forged or expired token is refused there.
 */
export async function requireMarketplaceOperator(action = "This"): Promise<void> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error(`${action} needs marketplace operator rights. Please sign in.`);

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc("mm_is_operator");
  if (error || data !== true) {
    throw new Error(`${action} needs marketplace operator rights.`);
  }
}
