export type MarketplacePublicConfig = {
  url: string;
  key: string;
};

export function resolveMarketplacePublicConfig(
  viteEnv: Record<string, string | undefined> | undefined,
  serverEnv: Record<string, string | undefined> | undefined,
): MarketplacePublicConfig {
  const url = serverEnv?.SUPABASE_URL ?? viteEnv?.VITE_SUPABASE_URL ?? "";
  const key =
    viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ??
    viteEnv?.VITE_SUPABASE_ANON_KEY ??
    serverEnv?.SUPABASE_PUBLISHABLE_KEY ??
    serverEnv?.SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment configuration: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).",
    );
  }

  return { url, key };
}
