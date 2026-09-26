/**
 * What a page's SEO is actually worth, and why.
 *
 * `seo_pages.seo_score` has held a single number written by the crawler, with
 * nothing to say which part of the page earned it. A number nobody can argue
 * with is a number nobody can act on, so this produces the components and the
 * findings as well, and the score is only their summary.
 *
 * The rule that shapes everything here: a component with no evidence is not
 * scored. It is returned as unverified and left out of the total. A page that
 * has never been crawled must not come back as "0 out of 100" - that reads as
 * a terrible page rather than an unexamined one, and acting on the difference
 * is the whole point of measuring.
 *
 * Nothing in this file talks to a database or a network, so every rule below
 * can be tested exactly as it will run.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export type ScoreIssue = {
  component: ComponentName;
  code: string;
  severity: Severity;
  detail: string;
  remediation: string;
};

export type ComponentName = "technical" | "content" | "schema" | "links" | "geo" | "indexation";

export type ComponentScore = {
  /** null when there was nothing to judge it on. */
  score: number | null;
  checked: number;
  passed: number;
  unverified: boolean;
};

export type PageScore = {
  url: string;
  /** null when no component could be judged at all. */
  score: number | null;
  components: Record<ComponentName, ComponentScore>;
  issues: ScoreIssue[];
  /** Which evidence this was computed from. */
  source: "crawl" | "gate" | "both" | "none";
  scored_at: string;
};

/** What the crawler recorded about a page, if it has been crawled. */
export type CrawlEvidence = {
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical_url: string | null;
  word_count: number | null;
  index_status: string | null;
  schema_json: unknown;
  http_status?: number | null;
};

/** What the indexing gate decided about a page, if it has been judged. */
export type GateEvidence = {
  state: string | null;
  indexable: boolean | null;
  sitemap_eligible: boolean | null;
  canonical_status: string | null;
  schema_status: string | null;
  hreflang_status: string | null;
  content_status: string | null;
  http_status: number | null;
  blocking_reason: string | null;
  fingerprint_class: string | null;
};

export type LinkEvidence = { inbound: number; outbound: number };

export type GeoEvidence = {
  country: string | null;
  language: string | null;
  hreflang_group: string | null;
};

export type PageEvidence = {
  url: string;
  crawl?: CrawlEvidence | null;
  gate?: GateEvidence | null;
  links?: LinkEvidence | null;
  geo?: GeoEvidence | null;
  /** Whether the sitemaps actually advertise this URL. */
  advertised?: boolean | null;
};

/** How much each component contributes when it could be judged. */
const WEIGHT: Record<ComponentName, number> = {
  technical: 25,
  content: 25,
  indexation: 20,
  schema: 10,
  links: 10,
  geo: 10,
};

/** Titles and descriptions long enough to be shown whole by a search engine. */
const TITLE_MIN = 15;
const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 165;
/** Below this a page is thin however well written it is. */
const THIN_WORDS = 120;

type Check = { ok: boolean; issue?: Omit<ScoreIssue, "component"> };

const pass = (): Check => ({ ok: true });
const fail = (code: string, severity: Severity, detail: string, remediation: string): Check => ({
  ok: false,
  issue: { code, severity, detail, remediation },
});

/** The technical half: does the page exist, say what it is, and allow itself in. */
function technicalChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];
  const status = e.gate?.http_status ?? e.crawl?.http_status ?? null;

  if (status !== null) {
    checks.push(
      status >= 200 && status < 300
        ? pass()
        : status >= 300 && status < 400
          ? fail(
              "redirect",
              "medium",
              `answers HTTP ${status}`,
              "Point the link at the destination so a crawler is not spending a hop on it.",
            )
          : fail(
              "http_status",
              "critical",
              `answers HTTP ${status}`,
              "A page a search engine cannot fetch cannot rank. Restore it or stop advertising it.",
            ),
    );
  }

  // The scheme is read off the URL, which exists for every page whether or not
  // anyone has looked at it. On its own that is not evidence about the page,
  // and counting it would give a page nobody has ever crawled a full technical
  // score - which is the one thing this engine must never do.
  if (e.crawl || e.gate) {
    checks.push(
      e.url.startsWith("https://") || e.url.startsWith("/")
        ? pass()
        : fail(
            "https",
            "high",
            "not served over https",
            "Serve the page over https; a search engine treats the two as different sites.",
          ),
    );
  }

  const canonical = e.crawl?.canonical_url ?? null;
  if (e.crawl) {
    if (!canonical) {
      checks.push(
        fail(
          "canonical_missing",
          "high",
          "no canonical",
          "Add a canonical so several URLs for one page do not compete with each other.",
        ),
      );
    } else if (!/^https?:\/\//i.test(canonical)) {
      checks.push(
        fail(
          "canonical_relative",
          "high",
          `canonical is a path: ${canonical}`,
          "A canonical is resolved against whatever host served it, so it has to be absolute.",
        ),
      );
    } else {
      checks.push(pass());
    }
  }

  if (e.gate?.canonical_status) {
    checks.push(
      /^(ok|pass|valid)$/i.test(e.gate.canonical_status)
        ? pass()
        : fail(
            "canonical_gate",
            "medium",
            `the gate reports canonical ${e.gate.canonical_status}`,
            "Look at what the gate recorded against this URL and correct the canonical it names.",
          ),
    );
  }

  if (e.gate?.hreflang_status) {
    checks.push(
      /^(ok|pass|valid|n\/a)$/i.test(e.gate.hreflang_status)
        ? pass()
        : fail(
            "hreflang",
            "medium",
            `hreflang ${e.gate.hreflang_status}`,
            "Every language of a page must name all the others, and itself, or none of them count.",
          ),
    );
  }

  return checks;
}

/** The content half: is there a page here worth showing anyone. */
function contentChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];
  if (!e.crawl) return checks;

  const title = (e.crawl.title ?? "").trim();
  if (!title) {
    checks.push(
      fail(
        "title_missing",
        "critical",
        "no title",
        "A page with no title is given one by the search engine, and it will not be the one you want.",
      ),
    );
  } else if (title.length < TITLE_MIN) {
    checks.push(
      fail(
        "title_short",
        "medium",
        `title is ${title.length} characters`,
        `Say what the page is about in at least ${TITLE_MIN} characters.`,
      ),
    );
  } else if (title.length > TITLE_MAX) {
    checks.push(
      fail(
        "title_long",
        "low",
        `title is ${title.length} characters`,
        `Beyond about ${TITLE_MAX} characters the end is cut off in the results.`,
      ),
    );
  } else {
    checks.push(pass());
  }

  const description = (e.crawl.meta_description ?? "").trim();
  if (!description) {
    checks.push(
      fail(
        "description_missing",
        "high",
        "no meta description",
        "Without one the search engine writes its own from the page, usually badly.",
      ),
    );
  } else if (description.length < DESC_MIN || description.length > DESC_MAX) {
    checks.push(
      fail(
        "description_length",
        "low",
        `description is ${description.length} characters`,
        `Aim between ${DESC_MIN} and ${DESC_MAX} characters so it is shown whole.`,
      ),
    );
  } else {
    checks.push(pass());
  }

  const h1 = (e.crawl.h1 ?? "").trim();
  checks.push(
    h1
      ? pass()
      : fail(
          "h1_missing",
          "high",
          "no H1",
          "The H1 is what the page says it is about in its own words. Add one.",
        ),
  );

  const words = e.crawl.word_count ?? null;
  if (words !== null) {
    checks.push(
      words >= THIN_WORDS
        ? pass()
        : fail(
            "thin_content",
            "high",
            `${words} words of visible text`,
            `Under ${THIN_WORDS} words there is usually not enough on the page to answer the query it is ranked for.`,
          ),
    );
  }

  if (e.gate?.content_status && !/^(ok|pass|ready)$/i.test(e.gate.content_status)) {
    checks.push(
      fail(
        "content_gate",
        "medium",
        `the gate reports content ${e.gate.content_status}`,
        "The gate recorded why; that reason is the thing to fix.",
      ),
    );
  }

  if (e.gate?.fingerprint_class && /duplicate/i.test(e.gate.fingerprint_class)) {
    checks.push(
      fail(
        "duplicate",
        "high",
        `judged ${e.gate.fingerprint_class}`,
        "Two pages that say the same thing compete with each other. Give this one something the other does not have.",
      ),
    );
  }

  return checks;
}

/** Structured data: is there any, and does it parse. */
function schemaChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];

  if (e.crawl) {
    const raw = e.crawl.schema_json;
    const empty =
      raw === null ||
      raw === undefined ||
      (Array.isArray(raw) && raw.length === 0) ||
      (typeof raw === "object" && raw !== null && Object.keys(raw).length === 0);
    if (empty) {
      checks.push(
        fail(
          "schema_missing",
          "medium",
          "no structured data",
          "Without schema the page can be read but not understood, and is left out of the richer results.",
        ),
      );
    } else {
      const blocks = Array.isArray(raw) ? raw : [raw];
      const typed = blocks.filter(
        (b) => b && typeof b === "object" && "@type" in (b as Record<string, unknown>),
      );
      checks.push(
        typed.length > 0
          ? pass()
          : fail(
              "schema_untyped",
              "medium",
              "structured data with no @type",
              "A block with no @type says nothing; give it the type the page actually is.",
            ),
      );
    }
  }

  if (e.gate?.schema_status) {
    checks.push(
      /^(ok|pass|valid)$/i.test(e.gate.schema_status)
        ? pass()
        : fail(
            "schema_gate",
            "medium",
            `the gate reports schema ${e.gate.schema_status}`,
            "Correct the block the gate named rather than adding another.",
          ),
    );
  }

  return checks;
}

/** Internal linking: can anything reach this page, and does it lead anywhere. */
function linkChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];
  if (!e.links) return checks;

  checks.push(
    e.links.inbound > 0
      ? pass()
      : fail(
          "orphan",
          "high",
          "nothing on this site links to it",
          "A page reachable only from a sitemap is treated as one nobody thought worth linking to.",
        ),
  );
  checks.push(
    e.links.outbound >= 3
      ? pass()
      : fail(
          "few_outbound",
          "low",
          `${e.links.outbound} links out`,
          "A page that leads nowhere is a dead end for a crawler and for a reader.",
        ),
  );

  return checks;
}

/** Geo: does the page know which country and language it is for. */
function geoChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];
  if (!e.geo) return checks;

  checks.push(
    e.geo.country
      ? pass()
      : fail(
          "country_missing",
          "medium",
          "no country recorded",
          "A page targeted at everyone is ranked for no one in particular.",
        ),
  );
  checks.push(
    e.geo.language
      ? pass()
      : fail(
          "language_missing",
          "medium",
          "no language recorded",
          "Without a language the page cannot join an hreflang group.",
        ),
  );
  if (e.geo.country) {
    checks.push(
      e.geo.hreflang_group
        ? pass()
        : fail(
            "hreflang_group_missing",
            "low",
            "not in an hreflang group",
            "A country page with no group cannot point at its own translations.",
          ),
    );
  }

  return checks;
}

/** Indexation: is the page allowed in, and is it advertised. */
function indexationChecks(e: PageEvidence): Check[] {
  const checks: Check[] = [];

  if (e.gate) {
    if (e.gate.indexable === false) {
      checks.push(
        fail(
          "not_indexable",
          "high",
          e.gate.blocking_reason
            ? `held back: ${e.gate.blocking_reason}`
            : "the gate does not allow indexing",
          "The blocking reason names what to fix; the gate lets the page in once it is fixed.",
        ),
      );
    } else if (e.gate.indexable === true) {
      checks.push(pass());
    }

    if (e.gate.state) {
      checks.push(
        /^(READY_FOR_INDEX|INDEX|INDEXED)$/i.test(e.gate.state)
          ? pass()
          : fail(
              "gate_state",
              "medium",
              `the gate has it as ${e.gate.state}`,
              "Only READY_FOR_INDEX reaches a sitemap; the state names why it has not.",
            ),
      );
    }
  }

  if (e.crawl?.index_status) {
    checks.push(
      /^(indexable|indexed)$/i.test(e.crawl.index_status)
        ? pass()
        : fail(
            "crawl_index_status",
            "medium",
            `the crawl found it ${e.crawl.index_status}`,
            "The page itself is saying it should not be indexed. Check its robots meta.",
          ),
    );
  }

  // Advertised and not eligible, or eligible and not advertised, are both
  // contradictions worth naming - they are the two ways a sitemap drifts.
  if (
    e.advertised !== null &&
    e.advertised !== undefined &&
    e.gate?.sitemap_eligible !== null &&
    e.gate?.sitemap_eligible !== undefined
  ) {
    if (e.advertised && !e.gate.sitemap_eligible) {
      checks.push(
        fail(
          "advertised_not_eligible",
          "high",
          "in a sitemap although the gate holds it back",
          "Either the gate is right and the sitemap should not carry it, or the block is stale.",
        ),
      );
    } else if (!e.advertised && e.gate.sitemap_eligible) {
      checks.push(
        fail(
          "eligible_not_advertised",
          "medium",
          "allowed in but no sitemap carries it",
          "A page search engines are never told about waits to be found by accident.",
        ),
      );
    } else {
      checks.push(pass());
    }
  }

  return checks;
}

/** A severity's weight when turning findings into a component score. */
const COST: Record<Severity, number> = {
  critical: 1,
  high: 0.75,
  medium: 0.4,
  low: 0.15,
};

function scoreComponent(checks: Check[]): {
  component: ComponentScore;
  issues: Omit<ScoreIssue, "component">[];
} {
  if (checks.length === 0) {
    return {
      component: { score: null, checked: 0, passed: 0, unverified: true },
      issues: [],
    };
  }
  const issues = checks.filter((c) => !c.ok).map((c) => c.issue!);
  // A component loses ground in proportion to how bad its failures are, not
  // merely how many there are: one critical failure should cost more than
  // three cosmetic ones.
  const cost = issues.reduce((total, issue) => total + COST[issue.severity], 0);
  const score = Math.max(0, Math.round(100 * (1 - cost / checks.length)));
  return {
    component: {
      score,
      checked: checks.length,
      passed: checks.length - issues.length,
      unverified: false,
    },
    issues,
  };
}

/**
 * Judge one page from whatever evidence exists for it.
 *
 * Components with no evidence are returned unverified and left out of the
 * total, so the score always means "out of what could be checked". A page with
 * no evidence at all scores null, not zero.
 */
export function scorePage(evidence: PageEvidence): PageScore {
  const runners: [ComponentName, (e: PageEvidence) => Check[]][] = [
    ["technical", technicalChecks],
    ["content", contentChecks],
    ["schema", schemaChecks],
    ["links", linkChecks],
    ["geo", geoChecks],
    ["indexation", indexationChecks],
  ];

  const components = {} as Record<ComponentName, ComponentScore>;
  const issues: ScoreIssue[] = [];

  for (const [name, run] of runners) {
    const { component, issues: found } = scoreComponent(run(evidence));
    components[name] = component;
    for (const issue of found) issues.push({ component: name, ...issue });
  }

  // Weighted across the components that could be judged, with the weights
  // renormalised so an unjudged component does not silently count as zero.
  let weighted = 0;
  let weight = 0;
  for (const [name, component] of Object.entries(components) as [ComponentName, ComponentScore][]) {
    if (component.score === null) continue;
    weighted += component.score * WEIGHT[name];
    weight += WEIGHT[name];
  }

  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  const source: PageScore["source"] =
    evidence.crawl && evidence.gate
      ? "both"
      : evidence.crawl
        ? "crawl"
        : evidence.gate
          ? "gate"
          : "none";

  return {
    url: evidence.url,
    score: weight === 0 ? null : Math.round(weighted / weight),
    components,
    issues,
    source,
    scored_at: new Date().toISOString(),
  };
}

/** The headline word for a score, for a screen that shows a colour. */
export function scoreBand(
  score: number | null,
): "unverified" | "critical" | "warning" | "fair" | "healthy" {
  if (score === null) return "unverified";
  if (score < 50) return "critical";
  if (score < 70) return "warning";
  if (score < 85) return "fair";
  return "healthy";
}
