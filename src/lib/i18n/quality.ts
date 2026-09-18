import type { LanguageDefinition } from "./registry";

/**
 * Checks a machine translation before anyone sees it.
 *
 * These are structural checks, not a judgement of fluency: the output must
 * exist, keep every placeholder, be written in the target script, not be the
 * model talking about the task, and be a plausible length. A translation that
 * fails a blocking check is not served; one that only raises warnings is
 * served with a lower score so reviewers can find it.
 */

export const MIN_QUALITY_SCORE = 0.5;

export type QualityAssessment = {
  accepted: boolean;
  score: number;
  /** Blocking problems. */
  errors: string[];
  /** Non-blocking problems. */
  warnings: string[];
};

const PLACEHOLDER =
  /⟦T\d+⟧|\{\{\s*[\w.]+\s*\}\}|\{[\w.]+\}|%(?:\d+\$)?[sdif@]|<\/?[a-zA-Z][^<>]*>|https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]}。、]/g;

export function extractPlaceholders(text: string): string[] {
  return (text.match(PLACEHOLDER) ?? []).map((p) => p.trim()).sort();
}

const SCRIPT_TEST: Record<string, RegExp> = {
  Latn: /\p{Script=Latin}/u,
  Cyrl: /\p{Script=Cyrillic}/u,
  Grek: /\p{Script=Greek}/u,
  Arab: /\p{Script=Arabic}/u,
  Hebr: /\p{Script=Hebrew}/u,
  Deva: /\p{Script=Devanagari}/u,
  Beng: /\p{Script=Bengali}/u,
  Guru: /\p{Script=Gurmukhi}/u,
  Gujr: /\p{Script=Gujarati}/u,
  Orya: /\p{Script=Oriya}/u,
  Taml: /\p{Script=Tamil}/u,
  Telu: /\p{Script=Telugu}/u,
  Knda: /\p{Script=Kannada}/u,
  Mlym: /\p{Script=Malayalam}/u,
  Sinh: /\p{Script=Sinhala}/u,
  Thai: /\p{Script=Thai}/u,
  Laoo: /\p{Script=Lao}/u,
  Khmr: /\p{Script=Khmer}/u,
  Mymr: /\p{Script=Myanmar}/u,
  Hans: /\p{Script=Han}/u,
  Hant: /\p{Script=Han}/u,
  Jpan: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  Kore: /\p{Script=Hangul}/u,
  Armn: /\p{Script=Armenian}/u,
  Geor: /\p{Script=Georgian}/u,
  Ethi: /\p{Script=Ethiopic}/u,
};

const LETTER = /\p{L}/gu;
const META =
  /^(?:here(?:'s| is)|sure[,!.]|translation\s*:|translated text\s*:|i (?:can(?:not|'t)|am unable))/i;

function countLetters(text: string): number {
  return (text.match(LETTER) ?? []).length;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

function sameMultiset(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function assessTranslation(input: {
  source: string;
  translated: string;
  target: LanguageDefinition;
  /** Protected-term tokens that did not survive. */
  lostTokens?: string[];
  /** Terminology problems from checkTerminology. */
  terminologyIssues?: string[];
  engineConfidence?: number | null;
  /** The source language is unknown (detected by the provider). */
  sourceUnknown?: boolean;
}): QualityAssessment {
  const errors: string[] = [];
  const warnings: string[] = [];
  const source = input.source.trim();
  const translated = input.translated.trim();

  if (!translated) errors.push("empty");
  if (input.lostTokens && input.lostTokens.length > 0) errors.push("protected_term_lost");
  if (!sameMultiset(extractPlaceholders(source), extractPlaceholders(translated))) {
    errors.push("placeholder_mismatch");
  }
  if (META.test(translated) || translated.includes("```")) errors.push("meta_text");

  const sourceLetters = countLetters(source);
  if (translated && sourceLetters >= 3) {
    const expected = SCRIPT_TEST[input.target.script];
    if (expected && !expected.test(translated)) errors.push("wrong_script");
  }

  if (translated && !input.sourceUnknown && translated === source && sourceLetters >= 3) {
    // Short labels ("SEO", "URL", "Vala TV") are often the same in many
    // languages; a sentence left untouched is not a translation.
    if (wordCount(source) >= 3) errors.push("untranslated");
    else warnings.push("unchanged");
  }

  if (translated && source.length >= 12) {
    const ratio = translated.length / source.length;
    if (ratio > 8 || ratio < 0.08) errors.push("length_ratio");
    else if (ratio > 4 || ratio < 0.2) warnings.push("length_ratio");
  }

  if ((source.match(/\n/g) ?? []).length !== (translated.match(/\n/g) ?? []).length) {
    warnings.push("line_breaks");
  }
  for (const issue of input.terminologyIssues ?? []) warnings.push(issue);

  const base =
    typeof input.engineConfidence === "number"
      ? Math.max(0, Math.min(1, input.engineConfidence))
      : 0.8;
  const score = Math.max(
    0,
    Math.round((base - warnings.length * 0.1 - errors.length * 0.5) * 1000) / 1000,
  );
  return {
    accepted: errors.length === 0 && score >= MIN_QUALITY_SCORE,
    score,
    errors,
    warnings,
  };
}
