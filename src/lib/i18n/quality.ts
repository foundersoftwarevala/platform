import { parseMessage } from "./format";
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

function matchPlaceholders(text: string): string[] {
  return (text.match(PLACEHOLDER) ?? []).map((p) => p.trim());
}

const ICU_BLOCK = /\{\s*[\w.]+\s*,\s*(?:plural|selectordinal|select)\s*,/;

/**
 * The placeholders a translation must keep.
 *
 * For an ICU plural or select message, a branch body is text, not a
 * placeholder ("{Paid}" in `{status, select, paid {Paid} other {…}}` is the word
 * Paid), and the target language may have more or fewer plural branches than
 * English (Arabic six, Japanese one), each repeating the same variables. So for
 * those the message is parsed, and what must survive is the set of argument
 * names and of tags and URLs in the text parts - each once.
 */
export function extractPlaceholders(text: string): string[] {
  if (!ICU_BLOCK.test(text)) return matchPlaceholders(text).sort();
  let nodes: ReturnType<typeof parseMessage>;
  try {
    nodes = parseMessage(text);
  } catch {
    return matchPlaceholders(text).sort();
  }
  const found = new Set<string>();
  const walk = (list: typeof nodes) => {
    for (const node of list) {
      if (typeof node === "string") {
        for (const p of matchPlaceholders(node)) found.add(p);
      } else if (node.kind === "simple") {
        found.add(`{${node.name}}`);
      } else if (node.kind !== "pound") {
        found.add(`{${node.name}, ${node.kind}}`);
        for (const branch of node.options.values()) walk(branch);
      }
    }
  };
  walk(nodes);
  return [...found].sort();
}

/** The prose of a message: for an ICU message, the text of its branches without the syntax. */
function proseOf(text: string): string {
  if (!ICU_BLOCK.test(text)) return text;
  let nodes: ReturnType<typeof parseMessage>;
  try {
    nodes = parseMessage(text);
  } catch {
    return text;
  }
  const parts: string[] = [];
  const walk = (list: typeof nodes) => {
    for (const node of list) {
      if (typeof node === "string") parts.push(node);
      else if (node.kind !== "simple" && node.kind !== "pound")
        for (const branch of node.options.values()) walk(branch);
    }
  };
  walk(nodes);
  return parts.join(" ");
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

/** Letters and digits of a word, for comparing words across punctuation. */
function bare(word: string): string {
  return word.replace(/[^\p{L}\p{N}]/gu, "");
}

/** A word kept as it is in any language: a coined name ("EduNex") or an acronym ("SEO"). */
const NAME_LIKE = /^(?:\p{Lu}[\p{L}\d]*\p{Lu}[\p{L}\d]*|\p{Lu}{2,}\d*)$/u;

/**
 * Whether at least half the letters of a translation are in the target
 * script, leaving out what it keeps from the English on purpose: placeholders,
 * links, protected glossary terms and name-like words of the source. Short
 * remainders are not judged.
 */
function mostlyInScript(
  source: string,
  translated: string,
  script: RegExp,
  keptTerms: readonly string[],
): boolean {
  const kept = new Set(
    [
      ...source.split(/\s+/).filter((word) => NAME_LIKE.test(bare(word))),
      ...keptTerms.flatMap((t) => t.split(/\s+/)),
    ]
      .map(bare)
      .filter(Boolean),
  );
  const rest = proseOf(translated)
    .replace(PLACEHOLDER, " ")
    .split(/\s+/)
    .filter((word) => !kept.has(bare(word)))
    .join(" ");
  const letters = rest.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return true;
  const inScript = letters.filter((letter) => script.test(letter)).length;
  return inScript * 2 >= letters.length;
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
  /** Text the translation keeps from the source on purpose (locked glossary terms). */
  keptTerms?: readonly string[];
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
    else if (
      expected &&
      input.target.script !== "Latn" &&
      !mostlyInScript(source, translated, expected, input.keptTerms ?? [])
    ) {
      // One letter of the target script is not a translation: "Apply now अभी"
      // is English with a word added.
      errors.push("wrong_script");
    }
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
  for (const issue of input.terminologyIssues ?? []) {
    // A term an operator forbade must not reach a reader; a missing preferred
    // term only lowers the score.
    if (issue.startsWith("glossary_forbidden:")) errors.push(issue);
    else warnings.push(issue);
  }

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
