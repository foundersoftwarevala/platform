import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
  getCurrentLanguage as getCurrentLanguageFromService,
  setCurrentLanguage as setCurrentLanguageInService,
} from "@/lib/i18n/language-service";
import {
  LANGUAGE_REGISTRY,
  getFallbackChain,
  getLanguage,
  resolveLanguage,
  type LanguageDefinition,
  type TextDirection,
} from "@/lib/i18n/registry";
import { formatMessage, type MessageValues } from "@/lib/i18n/format";
import { looksLikeProductName } from "@/lib/i18n/names";
import { messageContext, messageText } from "@/lib/i18n/messages";
import { UI_DICTIONARY } from "@/lib/i18n/ui-dictionary";

/**
 * The application's translation interface: <LanguageProvider> and
 * useLanguage().
 *
 * Languages come from the registry (src/lib/i18n/registry.ts), the current
 * language from the language service (src/lib/i18n/language-service.ts), and
 * text from, in order:
 *   1. the reviewed UI dictionary for the language (src/lib/i18n/ui-dictionary.ts)
 *   2. translations already received from the translation service
 *   3. the language's fallback chain (pt-BR -> pt), while 2 is pending
 *   4. English
 * Anything not found in 1 or 2 is requested from /api/marketplace/translate,
 * which answers from translation memory or the translation engine. Nothing is
 * invented on the client.
 *
 * The names exported here (LANGUAGES, TRANSLATIONS, translateText, findLanguage
 * and the rest) are kept so existing callers keep working. Language codes are
 * now canonical registry codes ("en", "pt-BR", "zh-Hans") rather than the old
 * uppercase identifiers.
 */

export type LanguageEntry = {
  code: string;
  flag: string;
  name: string;
  native: string;
};

function toEntry(language: LanguageDefinition): LanguageEntry {
  return {
    code: language.code,
    flag: language.flag,
    name: language.name,
    native: language.nativeName,
  };
}

/** Every enabled language, in registry order. */
export const LANGUAGES: LanguageEntry[] = LANGUAGE_REGISTRY.filter((l) => l.enabled).map(toEntry);

/** The reviewed UI dictionary, keyed by canonical code. */
export const TRANSLATIONS: Record<string, Record<string, string>> = UI_DICTIONARY;

const SOURCE_TEXT: Record<string, string> = UI_DICTIONARY[DEFAULT_LANGUAGE] ?? {};

/**
 * The source (English) wording for a key: a catalogue key ("checkout.pay_now",
 * src/lib/i18n/messages), or the English wording itself for the older
 * dictionary-keyed calls.
 */
function sourceText(key: string): string {
  return messageText(key) ?? SOURCE_TEXT[key] ?? key;
}

/**
 * Static lookup: the reviewed dictionary along the language's fallback chain,
 * then English, then the key itself.
 */
export function translateText(key: string, lang: string) {
  for (const code of getFallbackChain(lang)) {
    const hit = UI_DICTIONARY[code]?.[key];
    if (hit) return hit;
  }
  return sourceText(key);
}

/* ------------------------------------------------------------------ remote */

/**
 * Where a language's received strings are remembered between visits. The
 * previous key (sv_lang_remote_v1_*) held answers produced from ambiguous
 * codes, so it is not read.
 */
const REMOTE_PREFIX = "sv_i18n_memory_v3_";
const REMOTE_MAX_ENTRIES = 3000;

/** Held strings are keyed `context + separator + source text`, so one word can differ by place. */
const SEPARATOR = "\u0001";

/**
 * Per language, the text translate() has returned for the page: whole strings,
 * and the pieces between {placeholders} of a sentence rendered with elements
 * in it (richText). The page translator reads the page's text nodes, and in a
 * Latin-script language a translated label ("Iniciar sesión") looks like any
 * other English text; this is how it knows not to send it back as source.
 */
const rendered = new Map<string, Set<string>>();
const RENDERED_MAX = 20_000;

function noteRendered(code: string, output: string, raw: string) {
  let set = rendered.get(code);
  if (!set) rendered.set(code, (set = new Set()));
  if (set.size > RENDERED_MAX) set.clear();
  set.add(output.trim());
  if (raw.includes("{")) {
    for (const piece of raw.split(/\{[^{}]*\}/)) if (piece.trim()) set.add(piece.trim());
  }
}

/**
 * How many strings go in one request. Small enough that the engine answers
 * within the request budget even when it is busy with other work, and large
 * enough that a whole page stays inside the caller's request allowance: the
 * homepage shows around 640 short strings, which is about eighteen requests
 * at this size. At twelve it took fifty-three, so a page translated into a
 * language memory did not hold yet ran into the per-minute limit half-way
 * through and the rest of the page stayed in English. The tier limits cap the
 * items (40) and the characters (6k) in one request; short interface strings
 * fit this batch comfortably inside both.
 */
const BATCH = 36;

type RemoteState = {
  /** source string -> translation, for one language. */
  held: Record<string, string>;
  /** Strings asked for and not yet answered. */
  pending: Set<string>;
  /** Strings the service answered without a usable translation this session. */
  unavailable: Set<string>;
  /** The service refused this language. */
  refused: boolean;
  /** No requests before this time (rate limit, quota, transient failure). */
  blockedUntil: number;
  /** Consecutive times the engine was unavailable; sets the next wait. */
  engineFailures: number;
  /**
   * Until this time, strings wait for the language pack instead of being sent
   * to the translation endpoint (0 once the pack has arrived or failed).
   */
  packUntil: number;
  /** Strings in a request that has not answered yet; not asked for again meanwhile. */
  inFlight: Set<string>;
  /** Brand names that are never translated (from the language pack). */
  locked: string[];
};

/** How long a page waits for its language pack before asking string by string. */
const PACK_WAIT_MS = 4000;

/**
 * The strings translation memory holds for a language, in one request
 * (GET /api/i18n/pack). Keys are `context + SEPARATOR + source`, the same as
 * `held`. Null when the pack is not available; the page then asks the
 * translation endpoint for what it needs, as before.
 */
async function fetchLanguagePack(
  code: string,
): Promise<{ entries: Record<string, string>; withheld: string[]; locked: string[] } | null> {
  try {
    const response = await fetch(`/api/i18n/pack?lang=${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      entries?: Record<string, string>;
      withheld?: string[];
      locked?: string[];
    };
    if (!payload.entries || typeof payload.entries !== "object") return null;
    return {
      entries: payload.entries,
      withheld: Array.isArray(payload.withheld) ? payload.withheld : [],
      locked: Array.isArray(payload.locked)
        ? payload.locked.filter((t): t is string => typeof t === "string" && t.length > 0)
        : [],
    };
  } catch {
    return null;
  }
}

/** True when nothing but these terms (and no other letters) is left in the text. */
export function onlyLockedTerms(text: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return false;
  let rest = text;
  let found = false;
  for (const term of terms) {
    if (rest.includes(term)) {
      rest = rest.split(term).join(" ");
      found = true;
    }
  }
  return found && !/\p{L}/u.test(rest);
}

/**
 * How long to wait after the engine was unavailable `failures` times in a
 * row: 15 s, 30 s, 60 s, 120 s, 240 s, then every 5 minutes.
 */
export function engineBackoffSeconds(failures: number): number {
  return Math.min(300, 15 * 2 ** Math.max(0, failures - 1));
}

function loadRemote(code: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMOTE_PREFIX + code);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveRemote(code: string, held: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(held);
    const bounded =
      entries.length > REMOTE_MAX_ENTRIES
        ? Object.fromEntries(entries.slice(-REMOTE_MAX_ENTRIES))
        : held;
    window.localStorage.setItem(REMOTE_PREFIX + code, JSON.stringify(bounded));
  } catch {
    /* a full or blocked store is not a reason to break the page */
  }
}

type FetchOutcome = {
  translations: Record<string, string>;
  /** Strings answered without a usable translation. */
  unavailable: string[];
  /** The engine is not configured anywhere: stop asking for every language. */
  serviceDown: boolean;
  /**
   * The engine did not answer this time (busy, timed out, restarting). The
   * batch is asked again after a back-off; nothing is given up for the session.
   */
  engineUnavailable: boolean;
  /** This language was refused. */
  refused: boolean;
  /** Seconds to wait before asking again, when the service said so. */
  retryAfter: number | null;
  reason: string | null;
};

async function authorizationHeader(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Ask the translation service for a batch. */
async function fetchTranslations(
  texts: string[],
  target: string,
  context: string | null,
): Promise<FetchOutcome> {
  const empty: FetchOutcome = {
    translations: {},
    unavailable: [],
    serviceDown: false,
    engineUnavailable: false,
    refused: false,
    retryAfter: null,
    reason: null,
  };
  try {
    const response = await fetch("/api/marketplace/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authorizationHeader()) },
      body: JSON.stringify({
        texts,
        target,
        source: DEFAULT_LANGUAGE,
        namespace: "ui",
        ...(context ? { context } : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      translations?: Record<string, string>;
      results?: { text: string; status: string }[];
      pending_reason?: string | null;
      error?: string;
      reason?: string;
    };
    const retryHeader = Number(response.headers.get("retry-after"));
    const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null;

    if (!response.ok) {
      const reason = payload.reason ?? null;
      return {
        ...empty,
        // "engine_unavailable" is also what a busy or restarting engine
        // answers, so it is a pause, not the end of translation for the visit.
        serviceDown: reason === "ai_not_configured",
        engineUnavailable: reason === "engine_unavailable",
        refused: reason === "invalid_language",
        retryAfter: retryAfter ?? (response.status === 429 ? 60 : 30),
        reason: payload.error ?? "Translation service refused the request.",
      };
    }
    const unavailable = (payload.results ?? [])
      .filter((r) => r.status === "needs_review" || r.status === "rejected")
      .map((r) => r.text);
    return {
      ...empty,
      translations: payload.translations ?? {},
      unavailable,
      engineUnavailable: payload.pending_reason === "engine_unavailable",
      retryAfter:
        payload.pending_reason === "quota_exceeded"
          ? 3600
          : payload.pending_reason === "engine_unavailable"
            ? 15
            : null,
    };
  } catch {
    return { ...empty, retryAfter: 30, reason: "Could not reach the translation service." };
  }
}

/* ---------------------------------------------------------------- provider */

type LanguageContextValue = {
  /** Canonical registry code of the current language. */
  lang: string;
  language: LanguageDefinition;
  dir: TextDirection;
  /** Accepts any spelling the registry recognises; ignores anything else. */
  setLanguage: (code: string) => void;
  /**
   * Text for a key, in the current language. `values` fills an ICU message
   * ("{count, plural, one {# item} other {# items}}"); `context` tells the
   * translation service where the string appears, so the same English word can
   * be translated differently in two places.
   */
  translate: (key: string, values?: MessageValues, options?: { context?: string }) => string;
  /**
   * True when `text` is something translate() has put on the page in the current
   * language. The page translator skips it: it is a translation, not English.
   */
  isRendered: (text: string) => boolean;
  version: number;
  /** False when no translation engine is configured. */
  serviceReady: boolean;
  /** Why it is not available, when it is not. */
  serviceReason: string | null;
};

const SOURCE_LANGUAGE_DEFINITION = getLanguage(DEFAULT_LANGUAGE)!;

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANGUAGE,
  language: SOURCE_LANGUAGE_DEFINITION,
  dir: SOURCE_LANGUAGE_DEFINITION.direction,
  setLanguage: () => undefined,
  translate: (key, values) =>
    values ? formatMessage(sourceText(key), values, DEFAULT_LANGUAGE) : sourceText(key),
  isRendered: () => false,
  version: 0,
  serviceReady: true,
  serviceReason: null,
});

/** Regional varieties of the source language are shown in the source text. */
function isSourceVariety(language: LanguageDefinition): boolean {
  return (
    language.iso639_3 === SOURCE_LANGUAGE_DEFINITION.iso639_3 &&
    language.script === SOURCE_LANGUAGE_DEFINITION.script
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The server always renders the source language; the client switches to the
  // stored or detected language before paint.
  const [lang, setLangState] = useState<string>(DEFAULT_LANGUAGE);
  const [version, setVersion] = useState(0);

  const remote = useRef<Record<string, RemoteState>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // drain is defined below; the language pack loader in stateFor calls it through this.
  const drainRef = useRef<((code: string) => void) | null>(null);
  const [service, setService] = useState<{ ready: boolean; reason: string | null }>({
    ready: true,
    reason: null,
  });
  const serviceDown = useRef(false);

  const sync = useCallback(() => {
    const current = getCurrentLanguageFromService();
    setLangState(current);
    applyDocumentLanguage(current);
    setVersion((v) => v + 1);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    sync();
  }, [sync]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail) sync();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && event.newValue) sync();
    };
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  const setLanguage = useCallback((code: string) => {
    const applied = setCurrentLanguageInService(code);
    if (!applied) return;
    setLangState(applied);
    setVersion((v) => v + 1);
  }, []);

  const stateFor = useCallback((code: string): RemoteState => {
    let state = remote.current[code];
    if (!state) {
      state = {
        held: loadRemote(code),
        pending: new Set(),
        unavailable: new Set(),
        refused: false,
        blockedUntil: 0,
        engineFailures: 0,
        packUntil: typeof window === "undefined" ? 0 : Date.now() + PACK_WAIT_MS,
        inFlight: new Set(),
        locked: [],
      };
      remote.current[code] = state;
      if (typeof window !== "undefined") {
        const created = state;
        void fetchLanguagePack(code).then((pack) => {
          created.packUntil = 0;
          if (pack) {
            created.locked = pack.locked;
            // Held for review on the server: shown in the fallback, not asked for.
            for (const key of pack.withheld) {
              if (typeof key !== "string" || created.held[key]) continue;
              created.unavailable.add(key);
              created.pending.delete(key);
            }
            let added = 0;
            for (const [key, text] of Object.entries(pack.entries)) {
              if (typeof text !== "string" || !text) continue;
              if (created.held[key] !== text) {
                created.held[key] = text;
                added += 1;
              }
              created.pending.delete(key);
            }
            if (added > 0) {
              saveRemote(code, created.held);
              setVersion((v) => v + 1);
            }
          }
          // Whatever the pack did not contain is asked for now.
          if (created.pending.size > 0) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => drainRef.current?.(code), 0);
          }
        });
      }
    }
    return state;
  }, []);

  /**
   * Send whatever has piled up for a language. Runs on a short timer so a
   * screenful of strings becomes one or two requests.
   */
  const drain = useCallback((code: string) => {
    const state = remote.current[code];
    if (!state || state.refused || serviceDown.current || state.pending.size === 0) return;
    // The language pack usually answers everything; wait for it briefly.
    if (state.packUntil > Date.now()) {
      timer.current = setTimeout(() => drain(code), Math.min(200, state.packUntil - Date.now()));
      return;
    }
    let answeredHere = false;
    for (const entry of state.pending) {
      if (state.held[entry]) {
        state.pending.delete(entry);
        continue;
      }
      // Only brand names ("Software Vala™"): shown as they are.
      const text = entry.slice(entry.indexOf(SEPARATOR) + 1);
      if (onlyLockedTerms(text, state.locked)) {
        state.held[entry] = text;
        state.pending.delete(entry);
        answeredHere = true;
      }
    }
    if (answeredHere) setVersion((v) => v + 1);
    if (state.pending.size === 0) return;
    const wait = state.blockedUntil - Date.now();
    if (wait > 0) {
      timer.current = setTimeout(() => drain(code), wait);
      return;
    }

    // Strings are kept as `contexttext`; one request carries one context.
    const first = state.pending.values().next().value as string;
    const context = first.slice(0, first.indexOf(SEPARATOR));
    const keys = Array.from(state.pending)
      .filter((entry) => entry.startsWith(`${context}${SEPARATOR}`))
      .slice(0, BATCH);
    keys.forEach((entry) => {
      state.pending.delete(entry);
      state.inFlight.add(entry);
    });
    const batch = keys.map((entry) => entry.slice(context.length + 1));

    void fetchTranslations(batch, code, context || null).then((outcome) => {
      for (const entry of keys) state.inFlight.delete(entry);
      const current = remote.current[code];
      if (!current) return;

      if (outcome.serviceDown) {
        serviceDown.current = true;
        current.pending.clear();
        setService({ ready: false, reason: outcome.reason });
        return;
      }
      if (outcome.refused) {
        current.refused = true;
        current.pending.clear();
        return;
      }
      if (outcome.engineUnavailable) {
        current.engineFailures += 1;
        outcome.retryAfter = Math.max(
          outcome.retryAfter ?? 0,
          engineBackoffSeconds(current.engineFailures),
        );
        setService({ ready: false, reason: outcome.reason });
      } else if (!outcome.reason) {
        if (current.engineFailures > 0) setService({ ready: true, reason: null });
        current.engineFailures = 0;
      }

      const cacheKey = (text: string) => `${context}${SEPARATOR}${text}`;
      let changed = false;
      for (const [source, translated] of Object.entries(outcome.translations)) {
        if (translated && translated !== current.held[cacheKey(source)]) {
          current.held[cacheKey(source)] = translated;
          changed = true;
        }
      }
      for (const text of outcome.unavailable) current.unavailable.add(cacheKey(text));

      // Anything in the batch that came back with nothing is asked again
      // later, not on every render.
      if (outcome.retryAfter) {
        current.blockedUntil = Date.now() + outcome.retryAfter * 1000;
        for (const text of batch) {
          if (!current.held[cacheKey(text)] && !current.unavailable.has(cacheKey(text))) {
            current.pending.add(cacheKey(text));
          }
        }
      } else {
        for (const text of batch) {
          if (!current.held[cacheKey(text)]) current.unavailable.add(cacheKey(text));
        }
      }

      if (changed) {
        saveRemote(code, current.held);
        setVersion((v) => v + 1);
      }
      if (current.pending.size > 0) {
        const delay = Math.max(200, current.blockedUntil - Date.now());
        timer.current = setTimeout(() => drain(code), delay);
      }
    });
  }, []);
  drainRef.current = drain;

  const translate = useCallback(
    (key: string, values?: MessageValues, options?: { context?: string }) => {
      const language = getLanguage(lang) ?? SOURCE_LANGUAGE_DEFINITION;
      const fill = (text: string) => (values ? formatMessage(text, values, language.code) : text);
      // What is shown in the visitor's language is remembered, so the page
      // translator never takes it for English source text (see isRendered).
      const shown = (text: string) => {
        const out = fill(text);
        noteRendered(language.code, out, text);
        return out;
      };
      const english = sourceText(key);
      if (language.code === DEFAULT_LANGUAGE || isSourceVariety(language)) return fill(english);

      const exact = UI_DICTIONARY[language.code]?.[key];
      if (exact) return shown(exact);
      if (typeof window === "undefined") return fill(english);
      // A product name is the same in every language (see src/lib/i18n/names.ts);
      // there is nothing to ask the server for.
      if (looksLikeProductName(english)) return fill(english);

      const context = options?.context ?? messageContext(key) ?? "";
      const cacheKey = `${context}${SEPARATOR}${english}`;
      const state = stateFor(language.code);
      const held = state.held[cacheKey];
      if (held) return shown(held);

      if (
        !serviceDown.current &&
        !state.refused &&
        !state.pending.has(cacheKey) &&
        !state.inFlight.has(cacheKey) &&
        !state.unavailable.has(cacheKey)
      ) {
        state.pending.add(cacheKey);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => drain(language.code), 120);
      }

      // While waiting, the language's own fallbacks (pt-BR shows pt).
      for (const code of getFallbackChain(language.code).slice(1)) {
        if (code === DEFAULT_LANGUAGE) break;
        const fallback = UI_DICTIONARY[code]?.[key] ?? remote.current[code]?.held[cacheKey];
        if (fallback) return shown(fallback);
      }
      return fill(english);
    },
    // `version` re-creates translate so consumers re-render when text arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, drain, stateFor, version],
  );

  const value = useMemo<LanguageContextValue>(() => {
    const language = getLanguage(lang) ?? SOURCE_LANGUAGE_DEFINITION;
    return {
      lang: language.code,
      language,
      dir: language.direction,
      setLanguage,
      translate,
      version,
      isRendered: (text: string) => rendered.get(language.code)?.has(text.trim()) ?? false,
      serviceReady: service.ready,
      serviceReason: service.reason,
    };
  }, [lang, setLanguage, translate, version, service]);

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/* ------------------------------------------------------ compatibility API */

/** Key of the stored language choice (canonical codes). */
export const CURRENT_LANGUAGE_KEY = LANGUAGE_STORAGE_KEY;

/** Registry entry for any recognised spelling of a language. */
export function findLanguage(code: string): LanguageEntry | undefined {
  const language = resolveLanguage(code);
  return language ? toEntry(language) : undefined;
}

export function getCurrentLanguage(): string {
  return getCurrentLanguageFromService();
}

export function setCurrentLanguage(code: string) {
  setCurrentLanguageInService(code);
}

export function applyLanguageDocumentState(code: string) {
  applyDocumentLanguage(code);
}

/** Keeps <html lang dir> in step with the stored choice outside the provider. */
export function useLanguageSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    applyDocumentLanguage(getCurrentLanguageFromService());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) applyDocumentLanguage(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && event.newValue)
        applyDocumentLanguage(event.newValue);
    };
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}

export function languageCount() {
  return LANGUAGES.length;
}
