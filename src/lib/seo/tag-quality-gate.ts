/**
 * What generated SEO output has to survive before it is allowed near a page.
 *
 * Anything a language model writes about a catalogue it cannot see will, given
 * the chance, assert that a product is the country's number one with 10,000
 * happy customers and a 4.9 rating. None of that is true, none of it is
 * checkable, and all of it is the kind of claim that costs a site its standing
 * with both a search engine and a regulator. So generated output is treated as
 * a proposal, not an answer, and everything below is a reason to refuse it.
 *
 * The rules are written to be run without a provider configured, so they can be
 * tested and relied upon before a single key exists.
 */

export type TagBundle = {
  primary: string;
  secondary: string[];
  longTail: string[];
  semantic: string[];
  geo: string[];
  entities: string[];
  questions: string[];
  titleCandidates: string[];
  metaDescriptionCandidates: string[];
};

export type GateContext = {
  category: string;
  country: string;
  /** Every country in the catalogue, so a keyword naming a different one is caught. */
  knownCountries?: string[];
};

export type GateFinding = { rule: string; detail: string; sample?: string };

export type GateResult = {
  ok: boolean;
  findings: GateFinding[];
  /** What survived, with the offending entries removed. Empty when ok is false. */
  cleaned: TagBundle | null;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Claims that cannot be true of a catalogue slot, or cannot be checked.
 *
 * A superlative and an invented number are different failures with the same
 * cause: the writer had no data and filled the gap. Both are refused.
 */
const UNSUPPORTED = [
  {
    rule: "superlative",
    re: /\b(no\.?\s*1|number one|#1|world'?s best|the best|leading|top[- ]rated|award[- ]winning|guaranteed)\b/i,
  },
  {
    rule: "fake_statistic",
    re: /\b\d[\d,.]*\s*(\+|plus)?\s*(customers|clients|users|installs|downloads|businesses|companies)\b/i,
  },
  { rule: "fake_rating", re: /\b([0-5](\.\d)?)\s*(\/\s*5|stars?|star rating)\b/i },
  { rule: "fake_review_count", re: /\b\d[\d,.]*\s*(reviews|ratings|testimonials)\b/i },
  {
    rule: "fake_pricing",
    re: /(?:₹|\$|€|£)\s?\d|(\b\d[\d,.]*\s*(per month|\/month|per year|\/year|lakh|crore)\b)/i,
  },
  { rule: "unsupported_percentage", re: /\b\d{1,3}\s?%/ },
];

/** A keyword with the same word three or more times is stuffing, not a phrase. */
function isStuffed(phrase: string): boolean {
  const words = norm(phrase)
    .split(" ")
    .filter((w) => w.length > 2);
  if (words.length < 3) return false;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= 3);
}

function looksLikeUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value.trim()) || /^www\./i.test(value.trim());
}

/**
 * Check a generated bundle, and return what is fit to keep.
 *
 * A finding does not always reject the whole bundle: a single bad long-tail
 * phrase is dropped and the rest is kept, because throwing away forty good
 * keywords over one is its own kind of waste. The bundle is rejected outright
 * only when what is wrong is structural - no primary keyword, a primary
 * keyword that is itself an unsupported claim, or the wrong country or
 * category, which means the generator was answering about something else.
 */
export function checkTagBundle(bundle: TagBundle, context: GateContext): GateResult {
  const findings: GateFinding[] = [];
  const fatal: GateFinding[] = [];

  const country = norm(context.country);
  const category = norm(context.category);

  const others = (context.knownCountries ?? [])
    .map(norm)
    .filter((c) => c && c !== country && c.length > 3);

  const keep = (phrase: string, field: string): boolean => {
    const value = phrase.trim();
    if (!value) return false;

    if (looksLikeUrl(value)) {
      findings.push({ rule: "malformed_url", detail: `${field} contains a URL`, sample: value });
      return false;
    }
    if (value.length > 120) {
      findings.push({
        rule: "overlong",
        detail: `${field} entry is ${value.length} characters`,
        sample: value.slice(0, 60),
      });
      return false;
    }
    for (const { rule, re } of UNSUPPORTED) {
      if (re.test(value)) {
        findings.push({
          rule,
          detail: `${field} makes a claim nothing can support`,
          sample: value,
        });
        return false;
      }
    }
    if (isStuffed(value)) {
      findings.push({ rule: "keyword_stuffing", detail: `${field} repeats a word`, sample: value });
      return false;
    }
    // A keyword naming a country this slot is not for belongs to another slot.
    const hit = others.find((other) => norm(value).includes(other));
    if (hit) {
      findings.push({
        rule: "country_mismatch",
        detail: `${field} names ${hit}, not ${context.country}`,
        sample: value,
      });
      return false;
    }
    return true;
  };

  const dedupe = (values: string[], field: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values ?? []) {
      if (!keep(value, field)) continue;
      const key = norm(value);
      if (seen.has(key)) {
        findings.push({
          rule: "duplicate_keyword",
          detail: `${field} repeats an entry`,
          sample: value,
        });
        continue;
      }
      seen.add(key);
      out.push(value.trim());
    }
    return out;
  };

  const primary = (bundle.primary ?? "").trim();
  if (!primary) {
    fatal.push({ rule: "missing_primary", detail: "no primary keyword" });
  } else if (!keep(primary, "primary")) {
    fatal.push({
      rule: "invalid_primary",
      detail: "the primary keyword did not pass",
      sample: primary,
    });
  } else {
    if (category && !norm(primary).includes(category.split(" ")[0])) {
      fatal.push({
        rule: "category_mismatch",
        detail: `the primary keyword does not mention ${context.category}`,
        sample: primary,
      });
    }
    if (country && !norm(primary).includes(country)) {
      findings.push({
        rule: "missing_geo",
        detail: `the primary keyword does not name ${context.country}`,
        sample: primary,
      });
    }
  }

  const cleaned: TagBundle = {
    primary,
    secondary: dedupe(bundle.secondary ?? [], "secondary"),
    longTail: dedupe(bundle.longTail ?? [], "longTail"),
    semantic: dedupe(bundle.semantic ?? [], "semantic"),
    geo: dedupe(bundle.geo ?? [], "geo"),
    entities: dedupe(bundle.entities ?? [], "entities"),
    questions: dedupe(bundle.questions ?? [], "questions"),
    titleCandidates: dedupe(bundle.titleCandidates ?? [], "titleCandidates"),
    metaDescriptionCandidates: dedupe(
      bundle.metaDescriptionCandidates ?? [],
      "metaDescriptionCandidates",
    ),
  };

  // A bundle that lost nearly everything is not worth keeping either: it means
  // the generator was not producing usable output, and half a keyword set is
  // a worse page than the one already there.
  const kept = cleaned.secondary.length + cleaned.longTail.length + cleaned.semantic.length;
  if (!fatal.length && kept < 3) {
    fatal.push({ rule: "too_little_survived", detail: `only ${kept} supporting keywords passed` });
  }

  return {
    ok: fatal.length === 0,
    findings: [...fatal, ...findings],
    cleaned: fatal.length === 0 ? cleaned : null,
  };
}
