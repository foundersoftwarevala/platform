/**
 * Translating what is already on the page.
 *
 * The interface has tens of thousands of English strings written straight into
 * the markup, and the storefront homepage is locked copy that must not be
 * rewritten. So instead of wrapping every literal in t(), this walks the
 * rendered page, collects the text that is actually visible, translates it
 * through the same pipeline as everything else, and writes it back.
 *
 * It is careful about what it touches:
 *   - never inside script, style, code, pre, textarea or svg
 *   - never inside an element marked data-no-translate, translate="no" or
 *     .notranslate (language names in the Language Manager, code samples)
 *   - only text that contains letters, and attributes people actually read
 *     (placeholder, title, aria-label, alt)
 *   - the original English is remembered, so switching back restores it
 *     exactly
 *
 * Nothing is invented: a string with no translation yet keeps its English
 * until the engine answers, and the answer is cached per language.
 */

export const NO_TRANSLATE_SELECTOR = "[data-no-translate],[translate='no'],.notranslate";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "TEXTAREA",
  "SVG",
  "PATH",
  "CANVAS",
  "TEMPLATE",
  "IFRAME",
]);

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

const LETTER = /\p{L}/u;
/** Placeholders and format tokens are not words. */
const TOKENS = /⟦[^⟧]*⟧|\{\{?[^{}]*\}?\}|%(?:\d+\$)?[sdif@]/g;

/** Text that is only a placeholder, number, symbol or code-like token is left alone. */
export function isTranslatableText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 2000) return false;
  // Letters outside placeholders: "⟦P0⟧" and "{count}" are not text to translate.
  if (!LETTER.test(trimmed.replace(TOKENS, " "))) return false;
  // A lone code-like token is not prose: "EN", "USD", "v1", "#12", "1.2".
  if (/^[A-Z]{1,4}$/.test(trimmed)) return false;
  if (trimmed.length <= 4 && /[\d#._-]/.test(trimmed) && !/\s/.test(trimmed)) return false;
  // The source language is English. Text written mostly in another script is
  // not source text: it is what the page already shows in the visitor's
  // language (from the dictionary, the language pack or an earlier answer),
  // and sending it back would ask the engine to translate Hebrew "from
  // English" and store the result.
  const letters = trimmed.replace(TOKENS, " ").match(/\p{L}/gu)?.length ?? 0;
  const latin = trimmed.replace(TOKENS, " ").match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (latin * 2 < letters) return false;
  return true;
}

function skipped(node: Node): boolean {
  let element: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.matches?.(NO_TRANSLATE_SELECTOR)) return true;
    element = element.parentElement;
  }
  return false;
}

export type Target =
  | { kind: "text"; node: Text; original: string }
  | { kind: "attribute"; element: Element; attribute: string; original: string };

/** Everything on the page that can be translated, with its English text. */
export function collectTargets(
  root: ParentNode & Node,
  originals: WeakMap<object, Map<string, string>>,
): Target[] {
  const targets: Target[] = [];
  const doc = root.ownerDocument ?? (root as unknown as Document);

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const text = node.nodeValue ?? "";
      if (!isTranslatableText(text)) return NodeFilter.FILTER_REJECT;
      if (skipped(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const remembered = originals.get(text)?.get("text");
    targets.push({ kind: "text", node: text, original: remembered ?? text.nodeValue ?? "" });
  }

  const elements = root.querySelectorAll?.("[placeholder],[title],[aria-label],[alt]") ?? [];
  for (const element of Array.from(elements)) {
    if (skipped(element)) continue;
    for (const attribute of ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value || !isTranslatableText(value)) continue;
      const remembered = originals.get(element)?.get(attribute);
      targets.push({ kind: "attribute", element, attribute, original: remembered ?? value });
    }
  }
  return targets;
}

function remember(
  originals: WeakMap<object, Map<string, string>>,
  key: object,
  slot: string,
  value: string,
) {
  const entry = originals.get(key) ?? new Map<string, string>();
  if (!entry.has(slot)) entry.set(slot, value);
  originals.set(key, entry);
}

/**
 * Write translations into the page. `lookup` returns the translation for an
 * English string, or undefined when there is none yet (the text stays as it
 * is). Returns how many pieces were written.
 */
export function applyTranslations(
  targets: Target[],
  lookup: (english: string) => string | undefined,
  originals: WeakMap<object, Map<string, string>>,
): number {
  let written = 0;
  for (const target of targets) {
    const original = target.original;
    const trimmed = original.trim();
    const translated = lookup(trimmed);
    if (translated === undefined || translated === trimmed) continue;
    // Keep the surrounding whitespace the markup had.
    const lead = original.slice(0, original.length - original.trimStart().length);
    const trail = original.slice(original.trimEnd().length);
    if (target.kind === "text") {
      remember(originals, target.node, "text", original);
      const next = `${lead}${translated}${trail}`;
      if (target.node.nodeValue !== next) {
        target.node.nodeValue = next;
        written += 1;
      }
    } else {
      remember(originals, target.element, target.attribute, original);
      if (target.element.getAttribute(target.attribute) !== translated) {
        target.element.setAttribute(target.attribute, translated);
        written += 1;
      }
    }
  }
  return written;
}

/** Put the English back (used when the visitor switches to English). */
export function restoreOriginals(
  targets: Target[],
  originals: WeakMap<object, Map<string, string>>,
): number {
  let restored = 0;
  for (const target of targets) {
    if (target.kind === "text") {
      const original = originals.get(target.node)?.get("text");
      if (original !== undefined && target.node.nodeValue !== original) {
        target.node.nodeValue = original;
        restored += 1;
      }
    } else {
      const original = originals.get(target.element)?.get(target.attribute);
      if (original !== undefined && target.element.getAttribute(target.attribute) !== original) {
        target.element.setAttribute(target.attribute, original);
        restored += 1;
      }
    }
  }
  return restored;
}

/** The English strings in these targets, de-duplicated. */
export function uniqueStrings(targets: Target[]): string[] {
  return Array.from(new Set(targets.map((t) => t.original.trim()).filter(Boolean)));
}
