import { useEffect, useRef } from "react";

import {
  applyTranslations,
  collectTargets,
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
 *
 * This is what makes the homepage, the chat and every other screen available
 * in all 140 languages without rewriting the locked copy. Anything marked
 * data-no-translate is left alone.
 */
export function PageTranslator() {
  const { lang, translate, version } = useLanguage();
  const originals = useRef(new WeakMap<object, Map<string, string>>());
  const pass = useRef<number>(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const english = lang === "en";

    const run = () => {
      if (cancelled) return;
      let targets: Target[] = [];
      try {
        targets = collectTargets(document.body, originals.current);
      } catch {
        return; // a detached tree mid-render; the next pass picks it up
      }
      if (english) {
        restoreOriginals(targets, originals.current);
        return;
      }
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

    return () => {
      cancelled = true;
      if (scheduled) clearTimeout(scheduled);
      observer.disconnect();
    };
    // `version` changes when a batch of translations arrives, which re-runs the pass.
  }, [lang, translate, version]);

  return null;
}
