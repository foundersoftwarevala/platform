/**
 * Fetching an address handed to an SEO / domain-health server function.
 *
 * Those functions take a URL or a domain from the request body and fetch it
 * from inside the server's network, where the database, internal services and
 * the cloud metadata endpoint (169.254.169.254) are reachable. Plain fetch()
 * would fetch any of them for whoever asked. This goes through the platform's
 * one checked fetcher (lib/demo/safe-fetch.server.ts): http/https only, default
 * ports only, no user:password@, public addresses only (checked at connect
 * time), every redirect hop re-checked, bounded time and size.
 *
 * It answers instead of throwing, in the shape the callers already used from
 * fetch(): `ok`, `status`, the body, and the redirect hops that were followed
 * (a non-empty list stands in for the 3xx a manual-redirect fetch would show).
 */
export type PublicFetchResult = {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  redirects: string[];
  contentType: string;
  /** Why nothing was fetched, when the address was refused or did not answer. */
  error: string | null;
};

export async function publicFetch(
  raw: string,
  options: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<PublicFetchResult> {
  const { safeFetch } = await import("@/lib/demo/safe-fetch.server");
  try {
    const page = await safeFetch(String(raw ?? ""), {
      maxBytes: options.maxBytes ?? 3_000_000,
      timeoutMs: options.timeoutMs ?? 15_000,
      maxRedirects: options.maxRedirects ?? 5,
    });
    return {
      ok: page.status >= 200 && page.status < 300,
      status: page.status,
      url: page.url,
      body: page.body,
      redirects: page.redirects,
      contentType: page.contentType,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: String(raw ?? ""),
      body: "",
      redirects: [],
      contentType: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Throws unless the address may be fetched (no network access). */
export async function assertFetchableUrl(raw: string): Promise<URL> {
  const { assertPublicUrl } = await import("@/lib/demo/safe-fetch.server");
  return assertPublicUrl(raw);
}
