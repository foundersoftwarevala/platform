import { useEffect, useRef } from "react";

import {
  applyTranslations,
  collectTargets,
  collectTargetsIn,
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
  /**
   * Whether this page has ever been shown in another language. Until it has,
   * English has nothing to put back, and the whole-page read it would take to
   * find nothing is skipped - on the home page that read is half a second.
   */
  const everTranslated = useRef(false);
  const title = useRef<{ original: string; applied: string } | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const english = lang === "en";
    /**
     * The first pass after the language, the dictionary or the page's own
     * translations change reads the whole page, exactly as before. Every pass
     * after that reads only what changed since - the nodes gathered here.
     */
    let whole = true;
    const changed = new Set<Node>();
    let observer: MutationObserver | null = null;

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
      const readWholePage = whole;
      const roots = [...changed];
      whole = false;
      changed.clear();

      translateTitle();
      // In English, content added to the page is already English: the one
      // thing to do is put back text translated before the switch, and the
      // whole-page pass does that.
      if (english && (!readWholePage || !everTranslated.current)) return;
      if (!english) everTranslated.current = true;

      let targets: Target[] = [];
      try {
        targets = readWholePage
          ? collectTargets(document.body, originals.current)
          : collectTargetsIn(roots, originals.current);
      } catch {
        // A detached tree mid-render; read the whole page next time instead.
        whole = readWholePage || whole;
        for (const root of roots) changed.add(root);
        return;
      }
      if (english) {
        restoreOriginals(targets, originals.current);
        // What was just written back is not a change to the page.
        observer?.takeRecords();
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
      // The translations just written are this component's own changes. Left in
      // the queue they came straight back as "the page changed" and started
      // another pass, which wrote again - dropping them here ends that loop.
      // Nothing else can be in the queue: records made before this task began
      // were delivered to the observer before it ran.
      observer?.takeRecords();
      pass.current += 1;
    };

    const schedule = (delay = 150) => {
      if (scheduled) clearTimeout(scheduled);
      scheduled = setTimeout(run, delay);
    };

    schedule(0);

    observer = new MutationObserver((records) => {
      let relevant = false;
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of Array.from(record.addedNodes)) {
            if (!english) changed.add(node);
            relevant = true;
          }
        } else if (record.type === "characterData") {
          // The page rewrote this text itself - React updating a label, say.
          // Our own writes never reach here (see takeRecords), so what it holds
          // now is the new English, and the English remembered for it is stale.
          originals.current.get(record.target)?.delete("text");
          if (!english) changed.add(record.target);
          relevant = true;
        } else if (record.type === "attributes" && record.attributeName && record.attributeName !== "dir") {
          originals.current.get(record.target)?.delete(record.attributeName);
          if (!english) changed.add(record.target);
          relevant = true;
        }
      }
      if (relevant && !english) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
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
      observer?.disconnect();
      titleObserver.disconnect();
    };
    // `version` changes when a batch of translations arrives, which re-runs the pass.
  }, [lang, translate, isRendered, version]);

  return null;
}
