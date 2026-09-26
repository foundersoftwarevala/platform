/**
 * Where a visitor came from, remembered until they become a lead.
 *
 * The lead endpoint recorded `source: "marketplace"` for every capture, so a
 * visitor who searched on Google, landed on a card slot and asked for a demo
 * was filed as a marketplace walk-in. The information needed to say otherwise
 * is present exactly once - in the URL and the referrer of the *first* page of
 * the visit - and it is gone by the time they reach a form several pages later.
 * So it is read once, kept for the tab, and sent with the lead.
 *
 * First touch wins. If a visitor arrives from a search engine and then clicks
 * a newsletter link, the search engine is what earned the lead; overwriting it
 * with the last thing they touched credits the wrong page, and crediting the
 * wrong page is how an SEO programme gets cancelled for not working.
 *
 * On privacy: this reads the address bar and document.referrer, both of which
 * the browser already gives every page, and nothing else. No fingerprint, no
 * address, no personal detail, no third party. It is kept in sessionStorage,
 * so it dies with the tab and never becomes a cross-site profile.
 */

export type Attribution = {
  landing_page: string | null;
  referrer: string | null;
  search_engine: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  captured_at: string | null;
};

const KEY = "sv.attribution.v1";

const EMPTY: Attribution = {
  landing_page: null,
  referrer: null,
  search_engine: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  captured_at: null,
};

/**
 * Which search engine a referrer belongs to, if any.
 *
 * Matched on the registrable part of the host rather than anywhere in the
 * string, so a page at example.com/google-review is not read as Google. The
 * list is the engines this catalogue is actually built for - the card slots
 * carry a `search_engines` array naming them - plus the ones that send traffic
 * everywhere.
 */
const ENGINES: { engine: string; hosts: RegExp }[] = [
  { engine: "google", hosts: /(^|\.)google(\.[a-z.]{2,6})?$/i },
  { engine: "bing", hosts: /(^|\.)bing\.com$/i },
  { engine: "yandex", hosts: /(^|\.)yandex(\.[a-z.]{2,6})?$/i },
  { engine: "naver", hosts: /(^|\.)naver\.com$/i },
  { engine: "baidu", hosts: /(^|\.)baidu\.com$/i },
  { engine: "duckduckgo", hosts: /(^|\.)duckduckgo\.com$/i },
  { engine: "yahoo", hosts: /(^|\.)(search\.)?yahoo(\.[a-z.]{2,6})?$/i },
  { engine: "ecosia", hosts: /(^|\.)ecosia\.org$/i },
  { engine: "brave", hosts: /(^|\.)search\.brave\.com$/i },
  { engine: "startpage", hosts: /(^|\.)startpage\.com$/i },
  { engine: "seznam", hosts: /(^|\.)seznam\.cz$/i },
  { engine: "qwant", hosts: /(^|\.)qwant\.com$/i },
];

export function classifySearchEngine(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }
  for (const { engine, hosts } of ENGINES) {
    if (hosts.test(host)) return engine;
  }
  return null;
}

/**
 * Read the attribution out of a URL and a referrer.
 *
 * Pure, so the classification can be tested without a browser. The referrer is
 * dropped when it points back at this same site: an internal hop is not where
 * the visitor came from, and recording it would make every lead look like a
 * self-referral.
 */
export function readAttribution(href: string, referrer: string | null): Attribution {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ...EMPTY };
  }

  const params = url.searchParams;
  const get = (name: string) => {
    const value = params.get(name);
    const trimmed = value?.trim() ?? "";
    // A campaign parameter longer than this is not a campaign name.
    return trimmed ? trimmed.slice(0, 200) : null;
  };

  let external = referrer?.trim() || null;
  if (external) {
    try {
      if (new URL(external).hostname === url.hostname) external = null;
    } catch {
      external = null;
    }
  }

  return {
    landing_page: `${url.pathname}${url.search}`.slice(0, 500) || "/",
    referrer: external ? external.slice(0, 500) : null,
    search_engine: classifySearchEngine(external),
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    captured_at: new Date().toISOString(),
  };
}

/** Whether an envelope says anything worth keeping. */
export function isAttributionMeaningful(a: Attribution): boolean {
  return Boolean(
    a.referrer || a.utm_source || a.utm_medium || a.utm_campaign || a.utm_term || a.utm_content,
  );
}

/**
 * Record the first touch of this visit, once.
 *
 * Safe to call on every page: after the first call with something worth
 * keeping it does nothing. Storage can throw in a private window, so every
 * access is guarded - a visitor with storage disabled still gets a lead, just
 * without the attribution.
 */
export function captureFirstTouch(href?: string, referrer?: string | null): Attribution {
  if (typeof window === "undefined") return { ...EMPTY };

  const existing = storedAttribution();
  if (existing && isAttributionMeaningful(existing)) return existing;

  const fresh = readAttribution(
    href ?? window.location.href,
    referrer ?? (typeof document === "undefined" ? null : document.referrer),
  );

  // A visit that began on a page with no referrer and no parameters is a
  // direct arrival. The landing page is still worth keeping, so it is stored,
  // but a later page with real attribution is allowed to replace it.
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    // Private window, or storage disabled. The lead still works.
  }
  return fresh;
}

function storedAttribution(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

/** The envelope to send with a lead, or an empty one if nothing was seen. */
export function currentAttribution(): Attribution {
  if (typeof window === "undefined") return { ...EMPTY };
  return storedAttribution() ?? { ...EMPTY };
}
