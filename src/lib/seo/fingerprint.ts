import { createHash } from "node:crypto";

/**
 * Content fingerprints, and the one question that matters at this scale:
 * is this page a real page, or is it another page with the country name
 * swapped?
 *
 * The platform publishes 7,280 card slots across 91 categories and 80
 * countries, heading for 18,200. Every one of them is built from the same
 * blueprint on purpose, so a naive duplicate check would condemn the whole
 * grid: shared structure is the design, not the defect. What must be caught is
 * the opposite case - a page whose only difference from its neighbour is the
 * word "Kenya" where the other says "USA".
 *
 * The masked fingerprint is how the two are told apart. A page's own country,
 * category and product names are replaced with placeholders before hashing, so
 * two pages that differ only by those names produce the *same* masked hash and
 * are reported as low value, while two pages with genuinely different
 * substance produce different masked hashes and are allowed through even
 * though they share a template.
 *
 * Everything here is pure and deterministic. No network, no database, no AI:
 * the safety gate has to keep working when every external service is down,
 * which is precisely when a bad page is most likely to slip out.
 */

/** What a fingerprint was taken of. */
export type FingerprintLayer =
  | "url"
  | "title"
  | "h1"
  | "description"
  | "intro"
  | "h2_structure"
  | "faq"
  | "features"
  | "entities"
  | "body"
  | "body_masked";

export type Fingerprint = {
  layer: FingerprintLayer;
  /** sha256 of the normalised text. Equal hashes mean identical content. */
  hash: string;
  /**
   * 64-bit simhash as 16 hex characters. Two texts that differ a little have
   * simhashes that differ in a few bits, which is what makes near-duplicate
   * detection possible without comparing every page with every other page.
   */
  simhash: string;
  /** How many tokens the text held, so a thin page is visible as thin. */
  tokens: number;
  /** The first characters of the normalised text, to make a report readable. */
  sample: string;
};

/** The names a page is allowed to differ by, and nothing else. */
export type MaskTerms = {
  country?: string | null;
  category?: string | null;
  product?: string | null;
  region?: string | null;
};

// ---------------------------------------------------------------- normalising

/**
 * Text as the fingerprint sees it.
 *
 * Case and punctuation go, because "Kenya's" and "kenya" are the same word for
 * this purpose. Nothing meaningful goes: country, category, product,
 * technology, feature and intent words all survive, because those are exactly
 * the words that tell one page from another.
 */
export function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Visible text of an HTML fragment, with script, style and markup removed. */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      // Numeric character references, decimal and hexadecimal. This is not a
      // nicety: the renderer writes an apostrophe as &#x27;, so every page for
      // Cote d'Ivoire failed the check that the page names its own country -
      // ninety-one real pages held back over an entity the reader would have
      // spelled out. A gate that fails closed must still fail for the right
      // reason.
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      // Ampersand last, so "&amp;#x27;" cannot be turned into an apostrophe by
      // the passes above.
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** A URL with the parts that never change meaning removed. */
export function normalizeUrl(input: string): string {
  let path = input.trim();
  const scheme = path.indexOf("://");
  if (scheme >= 0) {
    const afterHost = path.indexOf("/", scheme + 3);
    path = afterHost >= 0 ? path.slice(afterHost) : "/";
  }
  const query = path.indexOf("?");
  if (query >= 0) path = path.slice(0, query);
  const fragment = path.indexOf("#");
  if (fragment >= 0) path = path.slice(0, fragment);
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.toLowerCase();
}

export function tokenize(input: string): string[] {
  const normalised = normalizeText(input);
  return normalised ? normalised.split(" ").filter(Boolean) : [];
}

/**
 * Replace the names this page is entitled to differ by.
 *
 * Longest term first, so "South Africa" is masked as a country before "Africa"
 * can be masked as a region and leave "south" behind. Only whole words are
 * replaced, so masking "UK" never touches the middle of another word.
 */
export function maskTerms(text: string, terms: MaskTerms): string {
  const replacements: Array<[string, string]> = [];
  const add = (value: string | null | undefined, token: string) => {
    const term = normalizeText(String(value ?? ""));
    if (term.length >= 2) replacements.push([term, token]);
  };
  add(terms.country, " {country} ");
  add(terms.region, " {region} ");
  add(terms.category, " {category} ");
  add(terms.product, " {product} ");
  replacements.sort((a, b) => b[0].length - a[0].length);

  let out = ` ${normalizeText(text)} `;
  for (const [term, token] of replacements) {
    // Whole words only, and the loop repeats because replacing one occurrence
    // consumes the space the next one needs to match on.
    for (;;) {
      const at = out.indexOf(` ${term} `);
      if (at < 0) break;
      out = `${out.slice(0, at)}${token}${out.slice(at + term.length + 2)}`;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------------- hashing

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * A 64-bit simhash.
 *
 * Each token votes on each of 64 bits, weighted by how often it appears; the
 * sign of each column becomes that bit. Two texts sharing most of their tokens
 * agree on most of the bits, so the Hamming distance between two simhashes is a
 * usable distance between two documents - and it is one number per page rather
 * than a set, which is what keeps this affordable across 18,200 pages.
 */
export function simhash64(tokens: string[]): string {
  if (!tokens.length) return "0000000000000000";
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const columns = new Array<number>(64).fill(0);
  for (const [token, weight] of counts) {
    const digest = createHash("sha1").update(token, "utf8").digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = digest[bit >> 3];
      const set = (byte >> (7 - (bit & 7))) & 1;
      columns[bit] += set ? weight : -weight;
    }
  }

  let hex = "";
  for (let nibble = 0; nibble < 16; nibble += 1) {
    let value = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      value = (value << 1) | (columns[nibble * 4 + bit] > 0 ? 1 : 0);
    }
    hex += value.toString(16);
  }
  return hex;
}

/** How many of the 64 bits two simhashes disagree on. 0 means identical. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

/** Overlapping runs of `size` tokens - the classic near-duplicate unit. */
export function shingles(tokens: string[], size = 4): Set<string> {
  const out = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length) out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.add(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

/** Shared shingles over total shingles: 1 is identical, 0 shares nothing. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// -------------------------------------------------------------- fingerprints

export function fingerprint(layer: FingerprintLayer, text: string): Fingerprint {
  const normalised = layer === "url" ? normalizeUrl(text) : normalizeText(text);
  const tokens = layer === "url" ? normalised.split(/[/-]/).filter(Boolean) : tokenize(normalised);
  return {
    layer,
    hash: sha256(normalised),
    simhash: simhash64(tokens),
    tokens: tokens.length,
    sample: normalised.slice(0, 160),
  };
}

/**
 * The masked body fingerprint: the page with its own names taken out.
 *
 * This is the one that answers "is this just the neighbour with the country
 * swapped". Two pages whose masked hashes match have nothing of their own to
 * say beyond the names, however long they are.
 */
export function maskedFingerprint(text: string, terms: MaskTerms): Fingerprint {
  const masked = maskTerms(text, terms);
  const tokens = tokenize(masked);
  return {
    layer: "body_masked",
    hash: sha256(masked),
    simhash: simhash64(tokens),
    tokens: tokens.length,
    sample: masked.slice(0, 160),
  };
}

// ----------------------------------------------------------- classification

export type DuplicateClass =
  | "EXACT_DUPLICATE"
  | "NEAR_DUPLICATE"
  | "LOW_VALUE_DUPLICATE"
  | "TEMPLATE_ONLY"
  | "COUNTRY_VARIATION"
  | "PRODUCT_VARIATION"
  | "CATEGORY_VARIATION"
  | "VALID_VARIATION"
  | "UNVERIFIED";

/** The thresholds, in one place, so a report can state what was applied. */
export const THRESHOLDS = {
  /** Below this many body tokens a page is thin whatever else is true. */
  minBodyTokens: 120,
  /** Simhash bits apart, at or under which two bodies count as near-identical. */
  nearSimhashBits: 3,
  /** Shingle overlap at or above which two bodies count as near-identical. */
  nearJaccard: 0.9,
  /** Shingle overlap at or above which two bodies are template-similar only. */
  templateJaccard: 0.7,
} as const;

export type PageForComparison = {
  url: string;
  /** Visible body text of the page. */
  body: string;
  terms: MaskTerms;
};

export type PairVerdict = {
  a: string;
  b: string;
  classification: DuplicateClass;
  /** Why, in words a person can act on. */
  reason: string;
  exactBodyMatch: boolean;
  maskedMatch: boolean;
  simhashBits: number;
  jaccard: number;
};

/**
 * Compare two pages.
 *
 * The order of the tests is the whole argument:
 *
 *   - identical text is an exact duplicate, no further questions;
 *   - identical text *once the names are masked* is the country-swap case, and
 *     is low value however similar or different the raw text looks;
 *   - very similar text whose masked forms differ is a near duplicate, which
 *     goes to the quality gate rather than being condemned here;
 *   - similar text that is similar only because it shares a template, and
 *     which does have its own substance, is allowed.
 */
export function comparePages(a: PageForComparison, b: PageForComparison): PairVerdict {
  const aTokens = tokenize(a.body);
  const bTokens = tokenize(b.body);
  const aHash = sha256(normalizeText(a.body));
  const bHash = sha256(normalizeText(b.body));
  const aMasked = maskedFingerprint(a.body, a.terms);
  const bMasked = maskedFingerprint(b.body, b.terms);
  const bits = hammingDistance(simhash64(aTokens), simhash64(bTokens));
  const overlap = jaccard(shingles(aTokens), shingles(bTokens));

  const base = {
    a: a.url,
    b: b.url,
    exactBodyMatch: aHash === bHash,
    maskedMatch: aMasked.hash === bMasked.hash,
    simhashBits: bits,
    jaccard: Math.round(overlap * 10000) / 10000,
  };

  if (aHash === bHash) {
    return {
      ...base,
      classification: "EXACT_DUPLICATE",
      reason: "The two pages carry the same text, word for word.",
    };
  }
  if (aMasked.hash === bMasked.hash) {
    return {
      ...base,
      classification: "LOW_VALUE_DUPLICATE",
      reason:
        "Once each page's own country, category and product names are masked, the two are " +
        "identical: the only difference between them is those names.",
    };
  }
  if (bits <= THRESHOLDS.nearSimhashBits || overlap >= THRESHOLDS.nearJaccard) {
    return {
      ...base,
      classification: "NEAR_DUPLICATE",
      reason:
        `The bodies are ${bits} simhash bits apart with ${base.jaccard} shingle overlap, and they ` +
        "still differ once the names are masked, so the difference is small but real.",
    };
  }
  if (overlap >= THRESHOLDS.templateJaccard) {
    return {
      ...base,
      classification: "TEMPLATE_ONLY",
      reason:
        `Shingle overlap is ${base.jaccard}, which is the shared blueprint. The masked forms ` +
        "differ, so each page has substance of its own.",
    };
  }
  return {
    ...base,
    classification: "VALID_VARIATION",
    reason: `Shingle overlap is ${base.jaccard}; the two pages are substantially different.`,
  };
}

/**
 * What a single page is, on its own, before any neighbour is considered.
 *
 * A page can fail here without a twin: too few words is thin whoever else
 * exists.
 */
export function judgeOnePage(page: PageForComparison): {
  thin: boolean;
  tokens: number;
  ownTokens: number;
  reason: string | null;
} {
  const tokens = tokenize(page.body).length;
  const masked = maskedFingerprint(page.body, page.terms);
  if (tokens < THRESHOLDS.minBodyTokens) {
    return {
      thin: true,
      tokens,
      ownTokens: masked.tokens,
      reason: `The page carries ${tokens} words of visible text, under the ${THRESHOLDS.minBodyTokens} required.`,
    };
  }
  return { thin: false, tokens, ownTokens: masked.tokens, reason: null };
}
