import { Check, Globe2, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { detectBrowserLanguage } from "@/lib/i18n/language-service";
import { SUPPORTED_LANGUAGES, type LanguageDefinition } from "@/lib/i18n/registry";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

/**
 * The language selector. There is one, used everywhere a person can choose
 * the interface language: the storefront bar, sign-in, the chat, every
 * dashboard and console (inline in the shared shells, or as the floating
 * LanguageDock on screens whose header has no room for it).
 *
 * It lists the 140 languages of the registry (src/lib/i18n/registry.ts) in
 * alphabetical order of their English names, with letter headings and a
 * letter bar to jump to; the current language and the browser's language
 * come first. Search matches the English name, the language's own name and
 * the code. Choosing a language calls the provider's setLanguage - the same
 * one every t() reads - which stores it, sets <html lang dir> and re-renders
 * the page in that language.
 */

type Entry = LanguageDefinition & { letter: string; haystack: string };

/** Lower case, accents removed: "Español" and "espanol" match. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const ENTRIES: Entry[] = [...SUPPORTED_LANGUAGES]
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
  .map((language) => ({
    ...language,
    letter: fold(language.name).charAt(0).toUpperCase(),
    haystack: fold(
      [language.name, language.nativeName, language.code, ...language.aliases].join(" "),
    ),
  }));

/* ------------------------------------------------------------ registration */

// Inline selectors register while mounted; the floating dock shows only on
// screens that have none, so every screen has exactly one way to switch.
let mounted = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useInlineSelectorCount() {
  return useSyncExternalStore(
    subscribe,
    () => mounted,
    () => 0,
  );
}

/* --------------------------------------------------------------- selector */

export type LanguageSelectorProps = {
  /** "default" follows the theme; "dark" is for dark headers; "floating" is the dock's round button. */
  variant?: "default" | "dark" | "floating";
  /** Show the language's name next to the globe (hidden on narrow screens either way). */
  showName?: boolean;
  /** Replaces the trigger's classes (to match a bar that has its own button style). */
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  /** Internal: the dock does not count as an inline selector. */
  register?: boolean;
};

export function LanguageSelector({
  variant = "default",
  showName = true,
  triggerClassName,
  align = "end",
  side = "bottom",
  register = true,
}: LanguageSelectorProps) {
  const { t, lang, language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!register) return;
    mounted += 1;
    notify();
    return () => {
      mounted -= 1;
      notify();
    };
  }, [register]);

  const browser = useMemo(
    () => (typeof navigator === "undefined" ? null : detectBrowserLanguage()),
    [],
  );

  const folded = fold(query.trim());
  const matches = useMemo(
    () => (folded ? ENTRIES.filter((entry) => entry.haystack.includes(folded)) : ENTRIES),
    [folded],
  );
  const pinned = useMemo(() => {
    if (folded) return [];
    const codes = [lang, browser].filter(
      (code, i, all): code is string => Boolean(code) && all.indexOf(code) === i,
    );
    return codes
      .map((code) => ENTRIES.find((entry) => entry.code === code))
      .filter((entry): entry is Entry => Boolean(entry));
  }, [folded, lang, browser]);
  // What the arrow keys move through, in display order.
  const flat = useMemo(() => [...pinned, ...matches], [pinned, matches]);
  const letters = useMemo(() => [...new Set(matches.map((entry) => entry.letter))], [matches]);

  useEffect(() => setActive(0), [folded]);

  // Keep the highlighted row visible while moving with the keyboard.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Opening scrolls to the current language.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-code="${lang}"][data-all]`);
      row?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, lang]);

  const choose = useCallback(
    (code: string) => {
      setLanguage(code);
      setOpen(false);
    },
    [setLanguage],
  );

  const jump = (letter: string) => {
    // Scroll to the first language under the letter, leaving room for its
    // sticky heading. (scrollIntoView on a sticky heading measures where the
    // heading is stuck, not where its section starts.)
    const list = listRef.current;
    const heading = list?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    const first = heading?.nextElementSibling as HTMLElement | null | undefined;
    if (!list || !heading || !first) return;
    list.scrollTo({ top: first.offsetTop - heading.offsetHeight - 4, behavior: "smooth" });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(flat.length - 1);
    } else if (event.key === "Enter" && flat[active]) {
      event.preventDefault();
      choose(flat[active].code);
    }
  };

  const row = (entry: Entry, index: number, section: "pinned" | "all") => (
    <button
      key={`${section}-${entry.code}`}
      type="button"
      role="option"
      id={`${listId}-${index}`}
      aria-selected={entry.code === lang}
      data-index={index}
      data-code={entry.code}
      {...(section === "all" ? { "data-all": "" } : {})}
      onClick={() => choose(entry.code)}
      onMouseMove={() => setActive(index)}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors",
        index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {entry.flag}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate font-medium"
          dir={entry.direction}
          lang={entry.code}
          translate="no"
        >
          {entry.nativeName}
        </span>
        {entry.nativeName !== entry.name && (
          <span className="block truncate text-xs text-muted-foreground" translate="no">
            {entry.name}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] uppercase text-muted-foreground" translate="no">
        {entry.code}
      </span>
      {entry.code === lang && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
    </button>
  );

  let index = pinned.length;
  let lastLetter = "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("common.language_choose", { language: language.nativeName })}
        data-language-selector=""
        className={
          triggerClassName ??
          cn(
            "inline-flex items-center gap-1.5 rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            variant === "default" &&
              "h-9 border border-border bg-background px-2.5 hover:bg-accent",
            variant === "dark" &&
              "h-9 border border-white/15 bg-white/[0.06] px-2.5 text-white hover:bg-white/[0.12]",
            variant === "floating" &&
              "h-12 w-12 justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur hover:bg-accent sm:h-11 sm:w-auto sm:px-3.5",
          )
        }
      >
        <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {showName && (
          <span
            className={cn(
              "max-w-[9rem] truncate",
              variant === "floating" ? "hidden sm:inline" : "hidden sm:inline",
            )}
            lang={language.code}
            translate="no"
          >
            {language.nativeName}
          </span>
        )}
        {!showName && variant !== "floating" && (
          <span className="text-xs uppercase" translate="no">
            {language.code}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={12}
        className="flex w-[min(92vw,360px)] flex-col overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).querySelector("input")?.focus();
        }}
      >
        <div className="border-b border-border p-2.5">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("common.language_search")}
              aria-label={t("common.language_search")}
              aria-controls={listId}
              aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {letters.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-0.5" aria-label={t("common.language_jump")}>
              {letters.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => jump(letter)}
                  className="h-7 min-w-7 rounded-md px-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  translate="no"
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t("common.language")}
          className="relative max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain scroll-smooth p-1.5 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
        >
          {pinned.length > 0 && (
            <div className="pb-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("common.language_suggested")}
              </p>
              {pinned.map((entry, i) => row(entry, i, "pinned"))}
            </div>
          )}
          {matches.length > 0 ? (
            <div>
              {!folded && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("common.language_all", { count: matches.length })}
                </p>
              )}
              {matches.map((entry) => {
                const heading =
                  entry.letter !== lastLetter ? (
                    <p
                      key={`h-${entry.letter}`}
                      data-letter={entry.letter}
                      className="sticky top-0 z-10 scroll-mt-1 bg-popover/95 px-3 py-1 text-xs font-bold text-muted-foreground backdrop-blur"
                      translate="no"
                    >
                      {entry.letter}
                    </p>
                  ) : null;
                lastLetter = entry.letter;
                const item = row(entry, index, "all");
                index += 1;
                return heading ? [heading, item] : item;
              })}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("common.language_none", { query: query.trim() })}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The same selector as a floating button, for screens whose header has no
 * selector of its own. It appears only while no inline LanguageSelector is on
 * the screen, at the start corner (bottom-left; bottom-right in right-to-left
 * languages) - the end corner is where the assistants and route history sit.
 */
export function LanguageDock() {
  const inline = useInlineSelectorCount();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || inline > 0) return null;
  return (
    <div className="fixed bottom-4 start-4 z-[60] print:hidden" data-language-dock="">
      <LanguageSelector variant="floating" register={false} side="top" align="start" />
    </div>
  );
}
