/**
 * Product names, recognised without any data: the pipeline answers them as
 * themselves, and the browser does the same so it never has to ask for them.
 * Shared by src/lib/i18n/pipeline.ts and src/lib/language-catalog.ts.
 */

/** A word carrying a capital inside it: EduNex, OTScheduler, PharmaStock. */
const COINED_WORD = /^\p{Lu}[\p{L}\d]*\p{Lu}[\p{L}\d]*$/u;
/** A plain capitalised word or something with no letters at all (2026, +, ·). */
const NAME_COMPANION = /^(\p{Lu}[\p{Ll}\d]*|[^\p{L}]+)$/u;

/**
 * Is the whole string the name of a product?
 *
 * The marketplace lists names its sellers coined — "OTScheduler", "EduNex
 * Pro", "InventoryEdu Suite" — and those are not translated in any language:
 * a model asked to translate them returns them unchanged, which the quality
 * gate then reports as an untranslated answer in the wrong script. Every
 * visit in such a language paid for that again and filled the review queue
 * with names no reviewer can act on.
 *
 * A name is recognised conservatively: at most four words, none of them
 * lower-case, at least one carrying a capital inside it, and no sentence
 * punctuation. "12,000+ Software Solutions" is a sentence by that measure and
 * is still translated; the glossary remains the place for names without an
 * inner capital, such as "Software Vala".
 */
export function looksLikeProductName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /[.,;:!?]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  let coined = false;
  for (const word of words) {
    if (COINED_WORD.test(word)) {
      coined = true;
      continue;
    }
    if (!NAME_COMPANION.test(word)) return false;
  }
  return coined;
}
