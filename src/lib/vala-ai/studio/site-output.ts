export const MAX_SITE_HTML_CHARACTERS = 120000;

export function siteHtmlLimit(request: string, maximum = MAX_SITE_HTML_CHARACTERS): number {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_SITE_HTML_CHARACTERS)
    throw new Error(`HTML character limit must be between 1 and ${MAX_SITE_HTML_CHARACTERS}.`);
  let limit = maximum;
  const pattern =
    /\b(?:html|document|website)\s+(?:must be\s+)?(under|below|less than|at most|no more than|up to|max(?:imum)?(?: of)?)\s+(-?\d+(?:\.\d+)?)\s*(?:characters?|chars?)\b/gi;
  for (const match of request.matchAll(pattern)) {
    const exclusive = /^(under|below|less than)$/i.test(match[1]);
    const requested = Number(match[2]) - (exclusive ? 1 : 0);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw new Error("The requested HTML character limit must allow at least one character.");
    limit = Math.min(limit, requested);
  }
  return limit;
}

export function siteHtmlWarning(html: string, limit: number): string | null {
  return html.length > limit
    ? `Warning: generated HTML has ${html.length} characters, exceeding the ${limit}-character limit. The website was not truncated; shorten it before using it where that limit is required.`
    : null;
}
