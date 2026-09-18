import { useEffect, useRef } from "react";

import {
  applyTranslations,
  collectTargets,
  isTranslatableText,
  restoreOriginals,
  uniqueStrings,
  type Target,
} from "@/lib/i18n/auto-translate";
import { useLanguage } from "@/lib/language-catalog";

/**
 * Translates the page the visitor is looking at.
 *
 * Renders nothing and changes no markup: it reads the text nodes and readable
 * attributes under <body>, asks the language provider for each string (which
 * answers from the reviewed dictionary, translation memory or the platform's
 * own engine) and writes the answers back. New content - a route change, a
 * product list arriving, a dialog opening - is picked up by a MutationObserver.
 * The document title is translated the same way.
 *
 * This is what makes the homepage, the chat and every other screen available
 * in all 140 languages without rewriting the locked copy. Anything marked
 * data-no-translate is left alone, and so is text the page already shows
 * through t() (useTranslation): that is a translation in its own context, not
 * English to translate again.
 */
export function PageTranslator() {
  const { lang, translate, isRendered, version } = useLanguage();
  const originals = useRef(new WeakMap<object, Map<string, string>>());
  const pass = useRef<number>(0);
  const title = useRef<{ original: string; applied: string } | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const english = lang === "en";

    const translateTitle = () => {
      const current = document.title;
      // The router sets a new title on navigation; that is the new original.
      if (!title.current || current !== title.current.applied) {
        title.current = { original: current, applied: current };
      }
      const { original } = title.current;
      const next = english || !isTranslatableText(original) ? original : translate(original);
      if (next && next !== current) {
        title.current.applied = next;
        document.title = next;
      }
    };

    const run = () => {
      if (cancelled) return;
      let targets: Target[] = [];
      try {
        targets = collectTargets(document.body, originals.current);
      } catch {
        return; // a detached tree mid-render; the next pass picks it up
      }
      translateTitle();
      if (english) {
        restoreOriginals(targets, originals.current);
        return;
      }
      // Text rendered through t() is already in this language (see isRendered).
      targets = targets.filter((target) => {
        const current =
          target.kind === "text"
            ? (target.node.nodeValue ?? "")
            : (target.element.getAttribute(target.attribute) ?? "");
        return !isRendered(current);
      });
      // Ask for everything on the page. translate() answers at once when it
      // knows the string and queues the rest; the queue is drained in batches
      // and re-renders this effect through `version`.
      const strings = uniqueStrings(targets);
      const answers = new Map<string, string>();
      for (const source of strings) {
        const translated = translate(source);
        if (translated && translated !== source) answers.set(source, translated);
      }
      applyTranslations(targets, (source) => answers.get(source), originals.current);
      pass.current += 1;
    };

    const schedule = (delay = 150) => {
      if (scheduled) clearTimeout(scheduled);
      scheduled = setTimeout(run, delay);
    };

    schedule(0);

    const observer = new MutationObserver((records) => {
      // Ignore the writes this component just made.
      const relevant = records.some(
        (record) =>
          record.type === "childList" ||
          (record.type === "attributes" && record.attributeName !== "dir"),
      );
      if (relevant) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });
    // A route change replaces the <title>.
    const titleObserver = new MutationObserver(() => {
      if (document.title !== title.current?.applied) schedule();
    });
    const head = document.querySelector("head");
    if (head) titleObserver.observe(head, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      if (scheduled) clearTimeout(scheduled);
      observer.disconnect();
      titleObserver.disconnect();
    };
    // `version` changes when a batch of translations arrives, which re-runs the pass.
  }, [lang, translate, isRendered, version]);

  return null;
}
