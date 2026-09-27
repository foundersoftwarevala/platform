/**
 * When two demo addresses are the same demo.
 *
 * Intake already refused a second row for an address it had seen, but it
 * compared the strings: `https://delhi-ride-ui.lovable.app/` and
 * `https://delhi-ride-ui.lovable.app` and `HTTPS://Delhi-Ride-UI.lovable.app/`
 * are one demo and were three rows, each with its own investigation, its own
 * AI spend and its own entry in the manager's list. The operator who pasted the
 * address a second time had no way to know.
 *
 * So identity is computed rather than assumed:
 *
 *   the scheme and host are lower-cased, because neither is case-sensitive;
 *   a default port is dropped, because :443 on https means nothing;
 *   a `www.` prefix is dropped, because a demo host is not served differently
 *     with and without it in any case this platform has met;
 *   a trailing slash on the root is dropped, so `/` and `` agree;
 *   the fragment is dropped, because a browser never sends it;
 *   tracking parameters are dropped — the utm_ family, gclid, fbclid, ref and
 *     friends — because they describe how somebody arrived, not what they
 *     arrived at;
 *   every other query parameter is kept and sorted, because `?tenant=a` really
 *     is a different demo from `?tenant=b`, while `?a=1&b=2` and `?b=2&a=1`
 *     are not.
 *
 * What it deliberately does not do is follow redirects. That needs a request,
 * and identity has to be decidable before anything is fetched — otherwise a
 * duplicate is only found after the work of finding it has been done. The
 * redirect-aware half belongs after the fetch, where the final URL is known,
 * and canonicalFrom() is what records it.
 *
 * This file has no opinion about whether an address is safe to fetch. That is
 * assertPublicUrl in safe-fetch.server.ts, which is the only SSRF gate and
 * stays the only one.
 */

/**
 * Query parameters that describe the visit rather than the page.
 *
 * Kept deliberately short: a parameter is only listed when dropping it cannot
 * change which demo is being addressed. Anything unrecognised is kept, because
 * guessing wrongly here merges two demos into one, which is worse than keeping
 * two rows for one.
 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "referrer",
  "source",
]);

export type DemoIdentity = {
  /** The address as given, trimmed. */
  given: string;
  /** The comparable form. Two demos are the same demo when these match. */
  canonical: string;
  /** The host, lower-cased and without a leading www. */
  host: string;
  /** True when the scheme was upgraded or a redundant part was removed. */
  changed: boolean;
  /** What was removed or rewritten, for the audit entry. */
  notes: string[];
};

/**
 * The comparable form of a demo address.
 *
 * Throws nothing: an address that cannot be parsed comes back as its own
 * canonical form so the caller can still store and report it. Deciding whether
 * it is fetchable is somebody else's job.
 */
export function demoIdentity(raw: string): DemoIdentity {
  const given = String(raw ?? "").trim();
  const notes: string[] = [];

  let url: URL;
  try {
    url = new URL(given);
  } catch {
    return {
      given,
      canonical: given.toLowerCase(),
      host: "",
      changed: false,
      notes: ["unparseable"],
    };
  }

  const scheme = url.protocol.toLowerCase();
  if (url.protocol !== scheme) notes.push("scheme lower-cased");

  let host = url.hostname.toLowerCase();
  if (host !== url.hostname) notes.push("host lower-cased");
  if (host.startsWith("www.")) {
    host = host.slice(4);
    notes.push("www. removed");
  }

  const port =
    (scheme === "https:" && url.port === "443") || (scheme === "http:" && url.port === "80")
      ? ""
      : url.port;
  if (url.port && !port) notes.push("default port removed");

  const params = new URLSearchParams(url.search);
  const dropped: string[] = [];
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
      dropped.push(key);
    }
  }
  if (dropped.length) notes.push(`tracking parameters removed: ${dropped.join(", ")}`);

  const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = sorted.length
    ? "?" + sorted.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
    : "";
  if (url.search && url.search !== query) notes.push("query sorted");

  let path = url.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
    notes.push("trailing slash removed");
  }
  if (path === "/") path = "";

  if (url.hash) notes.push("fragment removed");

  const canonical = `${scheme}//${host}${port ? `:${port}` : ""}${path}${query}`;
  return { given, canonical, host, changed: canonical !== given, notes };
}

/**
 * The identity of the address a fetch actually landed on.
 *
 * A demo submitted as http:// that redirects to https://, or as a bare host
 * that redirects to a path, is the same demo as the one already stored under
 * its destination. This is the redirect-aware half: it is only callable once
 * something has been fetched and the final URL is known.
 */
export function canonicalFrom(finalUrl: string): string {
  return demoIdentity(finalUrl).canonical;
}

/**
 * Find the row that already holds this demo, by identity rather than by string.
 *
 * Returns the first match, which is the oldest row when the caller passes them
 * in creation order — so a duplicate attaches to the original rather than to
 * the most recent copy of it.
 */
export function findByIdentity<T extends { url?: string | null }>(
  rows: readonly T[],
  address: string,
): T | undefined {
  const wanted = demoIdentity(address).canonical;
  if (!wanted) return undefined;
  return rows.find((row) => demoIdentity(String(row.url ?? "")).canonical === wanted);
}
