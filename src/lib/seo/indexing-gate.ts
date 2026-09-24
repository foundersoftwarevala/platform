import {
  comparePages,
  fingerprint,
  htmlToText,
  judgeOnePage,
  maskedFingerprint,
  normalizeUrl,
  type DuplicateClass,
  type Fingerprint,
  type MaskTerms,
} from "./fingerprint";

/**
 * The one gate that decides whether a page may be indexed.
 *
 * No page answers this for itself any more. A route may render whatever it
 * likes; whether a crawler is told about it is settled here, from the page a
 * visitor actually receives, and the sitemap reads nothing but the answer.
 *
 * The rule is fail closed. A check that cannot be performed does not pass: it
 * returns UNVERIFIED, and UNVERIFIED is not indexable. A page nobody has
 * checked is a page nobody can vouch for, so silence keeps it out rather than
 * letting it through.
 *
 * Everything in this module is deterministic and offline. It reads a URL, the
 * HTML that URL returned, and the facts already stored about the entity behind
 * it. No AI, no external service, no live keyword tool: those may enrich a
 * report, but the safety gate has to keep working on the day they are all
 * down, which is exactly when a bad page is most likely to escape.
 */

// ------------------------------------------------------------------- states

export type SeoState =
  | "READY_FOR_INDEX"
  | "INDEX"
  | "NOINDEX"
  | "CONTENT_NOT_READY"
  | "DRAFT"
  | "TEST"
  | "ARCHIVED"
  | "BLOCKED"
  | "UNVERIFIED"
  | "ERROR";

/** The only two states a crawler is ever told about. */
export const INDEXABLE_STATES: ReadonlySet<SeoState> = new Set<SeoState>([
  "READY_FOR_INDEX",
  "INDEX",
]);

export type CheckResult = "PASS" | "FAIL" | "UNVERIFIED" | "NOT_APPLICABLE";

export type Check = {
  name: string;
  /** Whether a page may be indexed without this check passing. */
  required: boolean;
  result: CheckResult;
  detail: string;
};

export type Decision = {
  url: string;
  entityType: string;
  entityId: string | null;
  state: SeoState;
  indexable: boolean;
  sitemapEligible: boolean;
  qualityStatus: CheckResult;
  qualityScore: number;
  fingerprintClass: DuplicateClass;
  canonicalStatus: CheckResult;
  schemaStatus: CheckResult;
  hreflangStatus: CheckResult;
  contentStatus: CheckResult;
  httpStatus: number | null;
  blockingReason: string | null;
  duplicateOf: string | null;
  checks: Check[];
  fingerprints: Fingerprint[];
};

// -------------------------------------------------------------------- input

/** What the evaluator is told about a page, beside the HTML it returned. */
export type PageFacts = {
  url: string;
  entityType: "slot" | "product" | "category" | "country" | "blog" | "page";
  entityId?: string | null;
  /** The domain the canonical is allowed to point at, e.g. softwarevala.net. */
  site: string;
  /**
   * How the catalogue describes the thing behind this page. A publication
   * state of anything but "published" ends the evaluation immediately.
   */
  publication: "published" | "draft" | "test" | "archived" | "unknown";
  /** True when the record behind the page exists at all. */
  entityExists: boolean;
  /** The names the page is entitled to differ by, for the masked fingerprint. */
  terms: MaskTerms;
  /** Whether the named country is in the platform's own country list. */
  countryKnown?: boolean;
  /** Whether the named category exists in the catalogue. */
  categoryKnown?: boolean;
  /** How many hreflang alternates the architecture expects, when it expects any. */
  expectedHreflang?: number | null;
  /** Minimum internal links a page of this kind must carry. */
  minInternalLinks?: number;
};

export type Rendered = {
  status: number | null;
  html: string | null;
  /** Set when the fetch itself failed, which is an ERROR rather than a FAIL. */
  error?: string | null;
};

// ---------------------------------------------------------------- extraction

const PLACEHOLDERS = [
  "lorem ipsum",
  "coming soon",
  "untitled",
  "todo",
  "tbd",
  "placeholder",
  "your title here",
  "sample text",
  "test page",
];

function first(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function every(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

export type Extracted = {
  title: string | null;
  h1: string | null;
  description: string | null;
  robots: string | null;
  canonical: string | null;
  hreflangCodes: string[];
  hreflangTargets: string[];
  jsonLd: string[];
  h2s: string[];
  internalLinks: string[];
  bodyText: string;
};

/** What the page says about itself, read out of the HTML it actually sent. */
export function extract(html: string): Extracted {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  return {
    title: first(html, /<title[^>]*>([^<]*)<\/title>/i),
    h1: (() => {
      const raw = first(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
      return raw ? htmlToText(raw) : null;
    })(),
    description: first(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i),
    robots: first(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i),
    canonical: first(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i),
    hreflangCodes: every(html, /rel="alternate"[^>]+href[Ll]ang="([^"]*)"/gi),
    hreflangTargets: every(html, /rel="alternate"[^>]+href="([^"]*)"/gi),
    jsonLd: [...html.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(
      (match) => match[1],
    ),
    h2s: every(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map((raw) => htmlToText(raw)),
    internalLinks: every(bodyHtml, /href="(\/[^"#?][^"]*)"/g),
    bodyText: htmlToText(bodyHtml),
  };
}

/**
 * Whether a piece of copy says something.
 *
 * The word count is deliberately low for a heading and a title. A category
 * page's H1 is its category - "Academy", "Healthcare" - and demanding two
 * words of it blocked all ninety-one category pages on the first run, which is
 * the gate being wrong rather than the pages being wrong. What actually
 * catches an empty heading is emptiness, and what catches a lazy one is the
 * placeholder list; a prose field like a meta description is held to a higher
 * bar by its caller.
 */
function meaningful(value: string | null | undefined, minWords = 1): boolean {
  const text = (value ?? "").trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (PLACEHOLDERS.some((bad) => lower.includes(bad))) return false;
  return text.split(/\s+/).filter(Boolean).length >= minWords;
}

/** A two-letter language, optionally with a region: en, en-KE, x-default. */
function validHreflang(code: string): boolean {
  if (code === "x-default") return true;
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code);
}

const FABRICATION_RISK = [
  "aggregateRating",
  "ratingValue",
  "reviewCount",
  "review",
  "offers",
  "price",
  "availability",
];

// ------------------------------------------------------------- the evaluator

/**
 * Judge one page.
 *
 * Every check is recorded with its own result, so a blocked page names the
 * reason rather than reporting a number. A required check that is anything but
 * PASS blocks; an optional one only costs score.
 */
export function evaluatePage(facts: PageFacts, rendered: Rendered): Decision {
  const checks: Check[] = [];
  const add = (name: string, required: boolean, result: CheckResult, detail: string) => {
    checks.push({ name, required, result, detail });
  };

  const base = {
    url: normalizeUrl(facts.url),
    entityType: facts.entityType,
    entityId: facts.entityId ?? null,
    httpStatus: rendered.status,
    duplicateOf: null as string | null,
    fingerprints: [] as Fingerprint[],
  };

  const stop = (state: SeoState, reason: string): Decision => ({
    ...base,
    state,
    indexable: false,
    sitemapEligible: false,
    qualityStatus: state === "ERROR" ? "UNVERIFIED" : "FAIL",
    qualityScore: 0,
    fingerprintClass: "UNVERIFIED",
    canonicalStatus: "UNVERIFIED",
    schemaStatus: "UNVERIFIED",
    hreflangStatus: "UNVERIFIED",
    contentStatus: "UNVERIFIED",
    blockingReason: reason,
    checks,
  });

  // --- publication state, before anything is fetched or measured ----------
  if (!facts.entityExists) {
    add("entity_exists", true, "FAIL", "Nothing in the catalogue stands behind this URL.");
    return stop("BLOCKED", "There is no catalogue record behind this URL.");
  }
  add("entity_exists", true, "PASS", "A catalogue record stands behind this URL.");

  if (facts.publication !== "published") {
    const state: SeoState =
      facts.publication === "draft"
        ? "DRAFT"
        : facts.publication === "test"
          ? "TEST"
          : facts.publication === "archived"
            ? "ARCHIVED"
            : "UNVERIFIED";
    add(
      "publication_state",
      true,
      facts.publication === "unknown" ? "UNVERIFIED" : "FAIL",
      `The record behind this page is ${facts.publication}.`,
    );
    return stop(
      state,
      `The record behind this page is ${facts.publication}, so it is not indexed.`,
    );
  }
  add("publication_state", true, "PASS", "The record behind this page is published.");

  // --- the page itself -----------------------------------------------------
  if (rendered.error) {
    add("http_status", true, "UNVERIFIED", `The page could not be fetched: ${rendered.error}`);
    return stop(
      "ERROR",
      `The page could not be fetched, so nothing about it is verified: ${rendered.error}`,
    );
  }
  if (rendered.status !== 200) {
    add("http_status", true, "FAIL", `The page answered HTTP ${rendered.status}.`);
    return stop("BLOCKED", `The page answered HTTP ${rendered.status} rather than 200.`);
  }
  if (!rendered.html) {
    add("http_status", true, "UNVERIFIED", "The page answered 200 with no body to read.");
    return stop("ERROR", "The page answered 200 with no body, so nothing about it is verified.");
  }
  add("http_status", true, "PASS", "The page answered HTTP 200.");

  const page = extract(rendered.html);

  // --- robots --------------------------------------------------------------
  const robots = (page.robots ?? "").toLowerCase();
  if (robots.includes("noindex")) {
    add("robots", true, "FAIL", `The page asks not to be indexed: robots="${page.robots}".`);
    return stop(
      "NOINDEX",
      `The page carries robots="${page.robots}", so it stays out of the sitemap.`,
    );
  }
  add("robots", true, "PASS", page.robots ? `robots="${page.robots}"` : "No robots restriction.");

  // --- canonical -----------------------------------------------------------
  let canonicalStatus: CheckResult = "PASS";
  const canonical = (page.canonical ?? "").trim();
  if (!canonical) {
    canonicalStatus = "FAIL";
    add("canonical_present", true, "FAIL", "The page declares no canonical URL.");
  } else if (!/^https:\/\//i.test(canonical)) {
    canonicalStatus = "FAIL";
    add(
      "canonical_absolute",
      true,
      "FAIL",
      `The canonical is not an absolute https URL: ${canonical}`,
    );
  } else {
    let host = "";
    try {
      host = new URL(canonical).host.toLowerCase();
    } catch {
      host = "";
    }
    if (!host || host !== facts.site.toLowerCase()) {
      canonicalStatus = "FAIL";
      add(
        "canonical_domain",
        true,
        "FAIL",
        `The canonical points at ${host || "an unreadable host"} rather than ${facts.site}.`,
      );
    } else if (normalizeUrl(canonical) !== normalizeUrl(facts.url)) {
      // A canonical elsewhere is legitimate, but it means this URL is not the
      // one to index, so it must not enter the sitemap under its own name.
      canonicalStatus = "FAIL";
      base.duplicateOf = normalizeUrl(canonical);
      add(
        "canonical_self",
        true,
        "FAIL",
        `The page points its canonical at ${normalizeUrl(canonical)}, so that URL is the one to index.`,
      );
    } else {
      add("canonical_self", true, "PASS", "The page is its own canonical.");
    }
  }

  // --- title, H1, description ---------------------------------------------
  const titleOk = meaningful(page.title);
  add(
    "title",
    true,
    titleOk ? "PASS" : "FAIL",
    titleOk
      ? `"${page.title}"`
      : `The title is missing or placeholder text: ${JSON.stringify(page.title)}`,
  );
  const h1Ok = meaningful(page.h1);
  add(
    "h1",
    true,
    h1Ok ? "PASS" : "FAIL",
    h1Ok ? `"${page.h1}"` : `The H1 is missing or placeholder text: ${JSON.stringify(page.h1)}`,
  );
  const descriptionOk = meaningful(page.description, 5);
  add(
    "description",
    true,
    descriptionOk ? "PASS" : "FAIL",
    descriptionOk
      ? `${(page.description ?? "").length} characters`
      : `The meta description is missing or placeholder text: ${JSON.stringify(page.description)}`,
  );

  // --- identity ------------------------------------------------------------
  const lowerBody = page.bodyText.toLowerCase();
  const namesIt = (value: string | null | undefined) =>
    !value || lowerBody.includes(String(value).toLowerCase());
  const identityOk =
    namesIt(facts.terms.country) && namesIt(facts.terms.category) && namesIt(facts.terms.product);
  add(
    "page_identity",
    true,
    identityOk ? "PASS" : "FAIL",
    identityOk
      ? "The page names the country, category and product it is recorded against."
      : "The page does not name the country, category or product it is recorded against.",
  );

  if (facts.countryKnown === false) {
    add(
      "country_known",
      true,
      "FAIL",
      `"${facts.terms.country}" is not in the platform's country list.`,
    );
  } else if (facts.terms.country) {
    add(
      "country_known",
      true,
      facts.countryKnown === true ? "PASS" : "UNVERIFIED",
      facts.countryKnown === true
        ? `"${facts.terms.country}" is in the platform's country list.`
        : "The country was not checked against the platform's list.",
    );
  } else {
    add("country_known", false, "NOT_APPLICABLE", "This page is not about one country.");
  }

  if (facts.categoryKnown === false) {
    add("category_known", true, "FAIL", `"${facts.terms.category}" is not a catalogue category.`);
  } else if (facts.terms.category) {
    add(
      "category_known",
      true,
      facts.categoryKnown === true ? "PASS" : "UNVERIFIED",
      facts.categoryKnown === true
        ? `"${facts.terms.category}" is a catalogue category.`
        : "The category was not checked against the catalogue.",
    );
  } else {
    add("category_known", false, "NOT_APPLICABLE", "This page is not about one category.");
  }

  // --- content -------------------------------------------------------------
  const thinness = judgeOnePage({ url: facts.url, body: page.bodyText, terms: facts.terms });
  const contentStatus: CheckResult = thinness.thin ? "FAIL" : "PASS";
  add(
    "content_depth",
    true,
    contentStatus,
    thinness.reason ?? `The page carries ${thinness.tokens} words of visible text.`,
  );

  const emptyHeadings = page.h2s.filter((heading) => !heading.trim()).length;
  add(
    "no_empty_headings",
    true,
    emptyHeadings ? "FAIL" : "PASS",
    emptyHeadings
      ? `${emptyHeadings} headings are empty.`
      : `${page.h2s.length} headings, none empty.`,
  );

  // --- internal links ------------------------------------------------------
  const minLinks = facts.minInternalLinks ?? 3;
  const distinctLinks = new Set(page.internalLinks.map(normalizeUrl)).size;
  add(
    "internal_links",
    true,
    distinctLinks >= minLinks ? "PASS" : "FAIL",
    `${distinctLinks} distinct internal links (at least ${minLinks} required).`,
  );

  // --- hreflang ------------------------------------------------------------
  let hreflangStatus: CheckResult;
  const expected = facts.expectedHreflang ?? null;
  if (expected === null) {
    hreflangStatus = page.hreflangCodes.length ? "PASS" : "NOT_APPLICABLE";
    add(
      "hreflang",
      false,
      hreflangStatus,
      `${page.hreflangCodes.length} alternates; none required.`,
    );
  } else {
    const invalid = page.hreflangCodes.filter((code) => !validHreflang(code));
    const duplicated = page.hreflangCodes.length !== new Set(page.hreflangCodes).size;
    const hasDefault = page.hreflangCodes.includes("x-default");
    if (page.hreflangCodes.length !== expected) {
      hreflangStatus = "FAIL";
      add(
        "hreflang",
        true,
        "FAIL",
        `${page.hreflangCodes.length} alternates, ${expected} expected.`,
      );
    } else if (invalid.length) {
      hreflangStatus = "FAIL";
      add("hreflang", true, "FAIL", `Invalid language codes: ${invalid.slice(0, 5).join(", ")}`);
    } else if (duplicated) {
      hreflangStatus = "FAIL";
      add("hreflang", true, "FAIL", "The same language code appears more than once.");
    } else if (!hasDefault) {
      hreflangStatus = "FAIL";
      add("hreflang", true, "FAIL", "No x-default alternate.");
    } else {
      hreflangStatus = "PASS";
      add("hreflang", true, "PASS", `${expected} valid alternates including x-default.`);
    }
  }

  // --- structured data -----------------------------------------------------
  let schemaStatus: CheckResult = "PASS";
  if (!page.jsonLd.length) {
    schemaStatus = "NOT_APPLICABLE";
    add("schema", false, "NOT_APPLICABLE", "The page carries no structured data.");
  } else {
    const problems: string[] = [];
    for (const block of page.jsonLd) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(block);
      } catch (error) {
        problems.push(`invalid JSON (${String(error).slice(0, 80)})`);
        continue;
      }
      const nodes = (() => {
        const root = parsed as Record<string, unknown>;
        const graph = root?.["@graph"];
        return Array.isArray(graph) ? (graph as Record<string, unknown>[]) : [root];
      })();
      for (const node of nodes) {
        if (!node || typeof node !== "object") {
          problems.push("a structured-data node is not an object");
          continue;
        }
        if (!node["@type"]) problems.push("a structured-data node has no @type");
        // A claim about a rating, a review or a price is only allowed when the
        // catalogue actually holds one. Nothing here can prove it does, so the
        // presence of the field is the finding: it must not be emitted unless
        // the route was given real data, which is why the route omits it.
        for (const field of FABRICATION_RISK) {
          if (field in node) {
            problems.push(`${String(node["@type"])} claims "${field}", which needs verified data`);
          }
        }
      }
    }
    if (problems.length) {
      schemaStatus = "FAIL";
      add("schema", true, "FAIL", problems.slice(0, 4).join("; "));
    } else {
      add(
        "schema",
        true,
        "PASS",
        `${page.jsonLd.length} valid structured-data block(s), nothing fabricated.`,
      );
    }
  }

  // --- fingerprints --------------------------------------------------------
  base.fingerprints = [
    fingerprint("url", facts.url),
    fingerprint("title", page.title ?? ""),
    fingerprint("h1", page.h1 ?? ""),
    fingerprint("description", page.description ?? ""),
    fingerprint("h2_structure", page.h2s.join(" | ")),
    fingerprint("body", page.bodyText),
    maskedFingerprint(page.bodyText, facts.terms),
  ];

  // --- the verdict ---------------------------------------------------------
  const required = checks.filter((check) => check.required);
  const failed = required.filter((check) => check.result === "FAIL");
  const unverified = required.filter((check) => check.result === "UNVERIFIED");
  const passed = required.filter((check) => check.result === "PASS").length;
  const score = required.length ? Math.round((passed / required.length) * 100) : 0;

  const qualityStatus: CheckResult = failed.length
    ? "FAIL"
    : unverified.length
      ? "UNVERIFIED"
      : "PASS";

  let state: SeoState = "READY_FOR_INDEX";
  let blockingReason: string | null = null;
  if (failed.length) {
    state = contentStatus === "FAIL" && failed.length === 1 ? "CONTENT_NOT_READY" : "BLOCKED";
    blockingReason = `${failed[0].name}: ${failed[0].detail}`;
  } else if (unverified.length) {
    state = "UNVERIFIED";
    blockingReason = `${unverified[0].name} could not be verified: ${unverified[0].detail}`;
  }

  const indexable = INDEXABLE_STATES.has(state);
  return {
    ...base,
    state,
    indexable,
    sitemapEligible: indexable,
    qualityStatus,
    qualityScore: score,
    // Nothing has been compared with a neighbour yet, so this is honestly
    // unknown until the cross-page pass runs.
    fingerprintClass: "UNVERIFIED",
    canonicalStatus,
    schemaStatus,
    hreflangStatus,
    contentStatus,
    blockingReason,
    checks,
  };
}

// ------------------------------------------------------- the cross-page pass

export type CrossPageInput = {
  decision: Decision;
  /**
   * The page's full visible text, when the caller still has it. Supplying it
   * buys a worded verdict and the template-versus-variation distinction.
   * Omitting it is not a lesser check for the two findings that block - an
   * exact duplicate and a country swap are both decided by hash equality, and
   * a hash does not care whether the text is still in memory. A truncated
   * sample must never be passed here: two pages whose first hundred and sixty
   * characters agree are not the same page.
   */
  body?: string;
  terms?: MaskTerms;
};

/**
 * Compare pages with each other, once each has been judged on its own.
 *
 * Grouping is by the masked body hash, which is the cheap way to find the
 * country-swap case: every page whose own names are the only thing
 * distinguishing it lands in the same bucket. Only inside a bucket is the
 * expensive pairwise comparison done, so this stays affordable across 18,200
 * pages instead of growing as the square of them.
 */
export function applyCrossPageFindings(pages: CrossPageInput[]): Decision[] {
  const byUrl = new Map<string, number>();
  const byMasked = new Map<string, CrossPageInput[]>();
  const byBody = new Map<string, CrossPageInput[]>();

  for (const page of pages) {
    byUrl.set(page.decision.url, (byUrl.get(page.decision.url) ?? 0) + 1);
    const masked = page.decision.fingerprints.find((print) => print.layer === "body_masked");
    const body = page.decision.fingerprints.find((print) => print.layer === "body");
    if (masked) {
      if (!byMasked.has(masked.hash)) byMasked.set(masked.hash, []);
      byMasked.get(masked.hash)!.push(page);
    }
    if (body) {
      if (!byBody.has(body.hash)) byBody.set(body.hash, []);
      byBody.get(body.hash)!.push(page);
    }
  }

  const out: Decision[] = [];
  for (const page of pages) {
    const decision = { ...page.decision, checks: [...page.decision.checks] };
    const masked = decision.fingerprints.find((print) => print.layer === "body_masked");
    const body = decision.fingerprints.find((print) => print.layer === "body");

    // A URL that appears twice in one run means two records claim one page.
    const duplicateUrl = (byUrl.get(decision.url) ?? 0) > 1;
    decision.checks.push({
      name: "url_unique",
      required: true,
      result: duplicateUrl ? "FAIL" : "PASS",
      detail: duplicateUrl
        ? `${byUrl.get(decision.url)} records claim ${decision.url}.`
        : "One record claims this URL.",
    });

    let classification: DuplicateClass = "VALID_VARIATION";
    let detail = "No other page shares this page's content.";
    let twin: string | null = decision.duplicateOf;

    const exactGroup = body ? (byBody.get(body.hash) ?? []) : [];
    const maskedGroup = masked ? (byMasked.get(masked.hash) ?? []) : [];

    if (exactGroup.length > 1) {
      const other = exactGroup.find((candidate) => candidate.decision.url !== decision.url);
      classification = "EXACT_DUPLICATE";
      twin = other?.decision.url ?? twin;
      detail = `Word for word the same page as ${twin}.`;
    } else if (maskedGroup.length > 1) {
      const other = maskedGroup.find((candidate) => candidate.decision.url !== decision.url);
      if (other) {
        twin = other.decision.url;
        if (page.body && other.body) {
          const verdict = comparePages(
            { url: decision.url, body: page.body, terms: page.terms ?? {} },
            { url: other.decision.url, body: other.body, terms: other.terms ?? {} },
          );
          classification = verdict.classification;
          detail = verdict.reason;
        } else {
          // The masked hashes agree, which is the finding. Without the text
          // there is nothing more to say about it, and nothing more is needed.
          classification = "LOW_VALUE_DUPLICATE";
          detail =
            `Once each page's own country, category and product names are masked, this page and ` +
            `${twin} hash identically: the names are the only difference between them.`;
        }
      }
    }

    decision.fingerprintClass = classification;
    decision.duplicateOf = twin;
    const blocked =
      classification === "EXACT_DUPLICATE" || classification === "LOW_VALUE_DUPLICATE";
    decision.checks.push({
      name: "content_differentiation",
      required: true,
      result: blocked ? "FAIL" : "PASS",
      detail: `${classification}: ${detail}`,
    });

    // Re-settle the verdict now that the cross-page checks have been added.
    const required = decision.checks.filter((check) => check.required);
    const failed = required.filter((check) => check.result === "FAIL");
    const unverified = required.filter((check) => check.result === "UNVERIFIED");
    const passed = required.filter((check) => check.result === "PASS").length;
    decision.qualityScore = required.length ? Math.round((passed / required.length) * 100) : 0;
    decision.qualityStatus = failed.length ? "FAIL" : unverified.length ? "UNVERIFIED" : "PASS";

    if (failed.length) {
      // A page held back only because it says nothing of its own is not broken;
      // it is unfinished, and saying so is more useful than calling it blocked.
      const onlyDifferentiation =
        failed.length === 1 && failed[0].name === "content_differentiation";
      const onlyContent = failed.length === 1 && failed[0].name === "content_depth";
      decision.state = onlyDifferentiation || onlyContent ? "CONTENT_NOT_READY" : "BLOCKED";
      decision.blockingReason = `${failed[0].name}: ${failed[0].detail}`;
    } else if (unverified.length) {
      decision.state = "UNVERIFIED";
      decision.blockingReason = `${unverified[0].name} could not be verified: ${unverified[0].detail}`;
    } else {
      decision.state = "READY_FOR_INDEX";
      decision.blockingReason = null;
    }
    decision.indexable = INDEXABLE_STATES.has(decision.state);
    decision.sitemapEligible = decision.indexable;
    out.push(decision);
  }
  return out;
}
