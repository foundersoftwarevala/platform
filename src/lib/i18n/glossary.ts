import type { GlossaryHint } from "./engine/types";

/**
 * Controlled terminology.
 *
 * Terms come from public.i18n_glossary_terms. Before text reaches a provider,
 * locked terms are swapped for tokens the provider must return untouched, and
 * swapped back afterwards - so "Software Vala" is never translated, whatever
 * the engine thinks. Preferred terms are passed to the provider as hints and
 * checked in the result; forbidden terms are checked in the result.
 */

export type GlossaryRule = "locked" | "preferred" | "forbidden";

export type GlossaryTerm = {
  sourceTerm: string;
  /** locked: fixed rendering (null = keep the source term). Others: required. */
  targetTerm: string | null;
  sourceLanguage: string;
  /** null = every language. */
  targetLanguage: string | null;
  rule: GlossaryRule;
  caseSensitive: boolean;
  /** null = every namespace. */
  namespace: string | null;
};

export type ProtectedToken = { token: string; replacement: string };

const TOKEN = (index: number) => `⟦T${index}⟧`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a whole term, not the same letters inside a longer word. */
function termPattern(term: string, caseSensitive: boolean): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
    caseSensitive ? "gu" : "giu",
  );
}

export function selectTerms(
  terms: readonly GlossaryTerm[],
  scope: { source: string; target: string; namespace: string },
): GlossaryTerm[] {
  return terms.filter(
    (term) =>
      term.sourceLanguage === scope.source &&
      (term.targetLanguage === null || term.targetLanguage === scope.target) &&
      (term.namespace === null || term.namespace === scope.namespace),
  );
}

/**
 * Replace locked terms with tokens. Longer terms first, so "Software Vala
 * Academy" is protected as one term when it is defined.
 */
export function protectLockedTerms(
  text: string,
  terms: readonly GlossaryTerm[],
): { text: string; tokens: ProtectedToken[] } {
  const tokens: ProtectedToken[] = [];
  let out = text;
  const locked = terms
    .filter((term) => term.rule === "locked")
    .sort((a, b) => b.sourceTerm.length - a.sourceTerm.length);
  for (const term of locked) {
    out = out.replace(termPattern(term.sourceTerm, term.caseSensitive), (match) => {
      const token = TOKEN(tokens.length);
      tokens.push({ token, replacement: term.targetTerm ?? match });
      return token;
    });
  }
  return { text: out, tokens };
}

/** Put protected terms back. Reports tokens the provider lost. */
export function restoreLockedTerms(
  text: string,
  tokens: readonly ProtectedToken[],
): { text: string; missing: string[] } {
  let out = text;
  const missing: string[] = [];
  for (const { token, replacement } of tokens) {
    if (!out.includes(token)) {
      missing.push(token);
      continue;
    }
    out = out.split(token).join(replacement);
  }
  return { text: out, missing };
}

/** Preferred renderings for the terms that occur in this text. */
export function glossaryHints(text: string, terms: readonly GlossaryTerm[]): GlossaryHint[] {
  return terms
    .filter((term) => term.rule === "preferred" && term.targetTerm)
    .filter((term) => termPattern(term.sourceTerm, term.caseSensitive).test(text))
    .map((term) => ({ source: term.sourceTerm, target: term.targetTerm! }));
}

/** Problems with a translation against the terminology. Empty when none. */
export function checkTerminology(
  sourceText: string,
  translated: string,
  terms: readonly GlossaryTerm[],
): string[] {
  const issues: string[] = [];
  for (const term of terms) {
    if (!term.targetTerm) continue;
    const inSource = termPattern(term.sourceTerm, term.caseSensitive).test(sourceText);
    if (!inSource) continue;
    const inTarget = termPattern(term.targetTerm, term.caseSensitive).test(translated);
    if (term.rule === "preferred" && !inTarget) issues.push(`glossary_missing:${term.sourceTerm}`);
    if (term.rule === "forbidden" && inTarget) issues.push(`glossary_forbidden:${term.targetTerm}`);
  }
  return issues;
}
