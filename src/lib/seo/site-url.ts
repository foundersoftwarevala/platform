/**
 * The one place the public address of this site is decided.
 *
 * Canonical URLs, the sitemap and any absolute link all read it from here, so
 * moving between the testing domain and the production one is a single
 * configuration change rather than an edit in a dozen files. It defaults to the
 * production domain, because that is the address the business publishes.
 *
 * Set SITE_URL in the environment to point a deployment somewhere else.
 */

const PRODUCTION = "https://softwarevala.net";

function normalise(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** The canonical origin, without a trailing slash. */
export function siteUrl(): string {
  const configured =
    process.env.SITE_URL?.trim() || process.env.APP_BASE_URL?.trim() || "";
  return configured ? normalise(configured) : PRODUCTION;
}

/** An absolute URL for a path on this site. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Whether this deployment should be indexed.
 *
 * A deployment serving anything other than the production domain is a testing
 * copy, and letting a search engine index it would put a second, competing set
 * of the same pages in the index.
 */
export function indexable(): boolean {
  return siteUrl() === PRODUCTION;
}
