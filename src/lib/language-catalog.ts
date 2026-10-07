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
import { retryAfterFor } from "@/lib/i18n/realtime-budget";
import { LANGUAGE_SESSION_CHANGE_EVENT } from "@/lib/i18n/session-contract";
import {
  LANGUAGE_REGISTRY,
  getFallbackChain,
  getLanguage,
  resolveLanguage,
  type LanguageDefinition,
  type TextDirection,
} from "@/lib/i18n/registry";
import { formatMessage, type MessageValues } from "@/lib/i18n/format";
import { TIER_LIMITS } from "@/lib/i18n/limits";
import { looksLikeProductName } from "@/lib/i18n/names";
import { messageContext, messageText } from "@/lib/i18n/messages";
import { UI_DICTIONARY } from "@/lib/i18n/ui-dictionary";
import type { LanguageBootstrap } from "@/lib/i18n/bootstrap";

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

/*
 * The request limits of the caller this browser is (src/lib/i18n/limits.ts):
 * a batch never carries more items or characters than the endpoint accepts
 * from it, and a string longer than one item may be is never sent. Signed in
 * means the "user" limits (an operator's are larger still); otherwise the
 * anonymous ones. Learned from the session whenever a request is made, and
 * the strict anonymous limits until then.
 */
let signedIn = false;

function requestLimits() {
  return TIER_LIMITS[signedIn ? "user" : "anonymous"];
}

/** How often the language pack is checked again while the page is open. */
const PACK_REFRESH_MS = 60_000;
const MAX_CACHED_LANGUAGES = 8;
const MAX_HELD_STRINGS = 10_000;

type RemoteState = {
  /** Source text currently shown because an exact translation is unavailable. */
  fallback: Set<string>;
  /** source string -> translation, for one language. */
  held: Record<string, string>;
  /** Strings asked for and not yet answered. */
  pending: Set<string>;
  /**
   * Strings the service answered without a usable translation. Cleared when a
   * changed language pack arrives, so a string a reviewer has since approved
   * is shown without a reload.
   */
  unavailable: Set<string>;
  /**
   * Strings the endpoint refuses for their size (or a request it found
   * invalid). Never sent again in this session, whatever the pack says.
   */
  refusedShape: Set<string>;
  /** ETag of the last language pack applied. */
  packTag: string | null;
  packKeys: Set<string>;
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

function remoteState(bootstrap?: LanguageBootstrap): RemoteState {
  return {
    fallback: new Set(),
    held: bootstrap
      ? Object.fromEntries(
          Object.entries(bootstrap.entries).filter(([key]) => !bootstrap.withheld.includes(key)),
        )
      : {},
    pending: new Set(),
    unavailable: new Set(bootstrap?.withheld ?? []),
    refusedShape: new Set(),
    packTag: bootstrap?.tag ?? null,
    packKeys: new Set(Object.keys(bootstrap?.entries ?? {})),
    refused: false,
    blockedUntil: 0,
    engineFailures: 0,
    packUntil: bootstrap || typeof window === "undefined" ? 0 : Date.now() + PACK_WAIT_MS,
    inFlight: new Set(),
    locked: bootstrap?.locked ?? [],
  };
}

/**
 * The strings translation memory holds for a language, in one request
 * (GET /api/i18n/pack). Keys are `context + SEPARATOR + source`, the same as
 * `held`. Null when the pack is not available; the page then asks the
 * translation endpoint for what it needs, as before.
 */
type LanguagePack = {
  entries: Record<string, string>;
  withheld: string[];
  locked: string[];
  tag: string | null;
};

async function fetchLanguagePack(
  code: string,
  etag?: string | null,
): Promise<LanguagePack | "disabled" | "unchanged" | null> {
  try {
    const response = await fetch(`/api/i18n/pack?lang=${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json", ...(etag ? { "If-None-Match": etag } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 304) return "unchanged";
    if (!response.ok) {
      // An operator switched the language off: nothing for it will be served.
      if (response.status === 400) {
        const payload = (await response.json().catch(() => ({}))) as { reason?: string };
        if (payload.reason === "language_disabled") return "disabled";
      }
      return null;
    }
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
      tag: response.headers.get("etag"),
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

type FetchOutcome = {
  translations: Record<string, string>;
  /** Strings answered without a usable translation. */
  unavailable: string[];
  /**
   * The endpoint found the request itself invalid (400/413 invalid_request):
   * asking again would be refused the same way, so the batch is not re-sent.
   */
  invalidRequest: boolean;
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

async function refreshLanguageSession(): Promise<void> {
  try {
    const response = await fetch("/api/i18n/session", { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Language session lookup failed.");
    const session = (await response.json()) as { authenticated?: boolean };
    signedIn = session.authenticated === true;
  } catch (error) {
    console.error(
      "[i18n] language session unavailable",
      error instanceof Error ? error.name : "error",
    );
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
    invalidRequest: false,
    engineUnavailable: false,
    refused: false,
    retryAfter: null,
    reason: null,
  };
  try {
    const response = await fetch("/api/marketplace/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
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
      if (reason === "invalid_request" && (response.status === 400 || response.status === 413)) {
        // Refused for its shape (too long, too many): not a pause, no retry.
        return { ...empty, invalidRequest: true, reason: payload.error ?? "Request refused." };
      }
      return {
        ...empty,
        // "engine_unavailable" is also what a busy or restarting engine
        // answers, so it is a pause, not the end of translation for the visit.
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
      // "in_progress": the engine is still translating this batch (it took
      // longer than the request budget) and will store the result; ask again
      // shortly. Not an engine failure, so no backoff and no "unavailable".
      retryAfter: retryAfterFor(payload.pending_reason),
    };
  } catch {
    return { ...empty, retryAfter: 30, reason: "Could not reach the translation service." };
  }
}

/* ---------------------------------------------------------------- provider */

type LanguageContextValue = {
  translationState: { pending: number; missing: number; fallback: number };
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
  translationState: { pending: 0, missing: 0, fallback: 0 },
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

export function LanguageProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: LanguageBootstrap;
}) {
  const [lang, setLangState] = useState<string>(
    getLanguage(initial?.code ?? DEFAULT_LANGUAGE)?.code ?? DEFAULT_LANGUAGE,
  );
  const [version, setVersion] = useState(0);
  const [translationState, setTranslationState] = useState({ pending: 0, missing: 0, fallback: 0 });

  const remote = useRef<Record<string, RemoteState>>({});
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    if (initial) remote.current[initial.code] = remoteState(initial);
  }
  const activeLanguage = useRef(lang);
  activeLanguage.current = lang;
  useEffect(() => {
    const publish = () => {
      const state = remote.current[lang];
      const status = {
        pending: state ? new Set([...state.pending, ...state.inFlight]).size : 0,
        missing: state ? new Set([...state.unavailable, ...state.refusedShape]).size : 0,
        fallback: state?.fallback.size ?? 0,
      };
      setTranslationState((previous) =>
        previous.pending === status.pending &&
        previous.missing === status.missing &&
        previous.fallback === status.fallback
          ? previous
          : status,
      );
      document.documentElement.setAttribute(
        "data-translation-status",
        status.fallback || status.pending || status.missing ? "partial" : "ready",
      );
      document.documentElement.setAttribute("data-translation-fallback", String(status.fallback));
      document.documentElement.setAttribute("data-translation-pending", String(status.pending));
      document.documentElement.setAttribute("data-translation-missing", String(status.missing));
      document.documentElement.setAttribute("data-translation-scope", "requested-content");
    };
    publish();
    const interval = setInterval(publish, 500);
    return () => clearInterval(interval);
  }, [lang, version]);
  // One timer per language. A single shared timer let a new string for one
  // language cancel another language's pending retry.
  const timers = useRef(new Map<string, { handle: ReturnType<typeof setTimeout>; due: number }>());
  // drain is defined below; the language pack loader in stateFor calls it through this.
  const drainRef = useRef<((code: string) => void) | null>(null);
  const [service, setService] = useState<{ ready: boolean; reason: string | null }>({
    ready: !initial?.reason,
    reason: initial?.reason ?? null,
  });

  /**
   * Run drain for a language after `delay` ms. A timer already due sooner is
   * left alone, so a stream of new strings never keeps postponing a send.
   */
  const schedule = useCallback((code: string, delay: number) => {
    const due = Date.now() + Math.max(0, delay);
    const existing = timers.current.get(code);
    if (existing && existing.due <= due) return;
    if (existing) clearTimeout(existing.handle);
    const handle = setTimeout(
      () => {
        timers.current.delete(code);
        drainRef.current?.(code);
      },
      Math.max(0, delay),
    );
    timers.current.set(code, { handle, due });
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const { handle } of pending.values()) clearTimeout(handle);
      pending.clear();
    };
  }, []);

  // The session decides which request limits apply; learn it early, so the
  // first batch is already built within the right ones.
  useEffect(() => {
    const clearTranslations = () => {
      remote.current = {};
      rendered.clear();
      for (const timer of timers.current.values()) clearTimeout(timer.handle);
      timers.current.clear();
      setVersion((v) => v + 1);
    };
    const refresh = async () => {
      const previous = signedIn;
      await refreshLanguageSession();
      if (previous !== signedIn) clearTranslations();
    };
    const changed = () => {
      clearTranslations();
      void refresh();
    };
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5 * 60_000);
    window.addEventListener(LANGUAGE_SESSION_CHANGE_EVENT, changed);
    return () => {
      clearInterval(interval);
      window.removeEventListener(LANGUAGE_SESSION_CHANGE_EVENT, changed);
    };
  }, []);

  const queryConsumed = useRef(false);
  const sync = useCallback(() => {
    const query = queryConsumed.current
      ? null
      : resolveLanguage(new URL(window.location.href).searchParams.get("lang") ?? "");
    queryConsumed.current = true;
    if (query) setCurrentLanguageInService(query.code, { target: null });
    const current = query?.code ?? getCurrentLanguageFromService();
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
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    };
  }, [sync]);

  const setLanguage = useCallback((code: string) => {
    const applied = setCurrentLanguageInService(code);
    if (!applied) return;
    setLangState(applied);
    setVersion((v) => v + 1);
  }, []);

  /**
   * Apply a language pack to a language's state. The pack is the server's
   * current word: a string it holds back for review is taken out of what this
   * browser remembers, and a string it serves replaces what is remembered.
   * When the pack has changed since the last one, strings marked unavailable
   * are asked about again (a reviewer may have approved them since).
   */
  const applyPack = useCallback(
    (code: string, state: RemoteState, pack: LanguagePack | "disabled" | "unchanged" | null) => {
      if (remote.current[code] !== state) return;
      state.packUntil = 0;
      if (pack === "unchanged") return;
      if (pack === "disabled") {
        state.refused = true;
        state.pending.clear();
        state.held = {};
        rendered.delete(code);
        setVersion((v) => v + 1);
        return;
      }
      if (pack) {
        let changed = false;
        if (pack.tag !== state.packTag) {
          if (state.packTag !== null) state.unavailable.clear();
          state.packTag = pack.tag;
          rendered.delete(code);
        }
        state.locked = pack.locked;
        for (const key of state.packKeys) {
          if (!(key in pack.entries) && key in state.held) {
            delete state.held[key];
            changed = true;
          }
        }
        state.packKeys = new Set(Object.keys(pack.entries));
        // Held for review or refused on the server: shown in the fallback and
        // not asked for, and no longer served from this browser's memory.
        for (const key of pack.withheld) {
          if (typeof key !== "string") continue;
          if (key in state.held) {
            delete state.held[key];
            changed = true;
          }
          state.unavailable.add(key);
          state.pending.delete(key);
        }
        for (const [key, text] of Object.entries(pack.entries)) {
          if (typeof text !== "string" || !text) continue;
          if (state.held[key] !== text) {
            state.held[key] = text;
            changed = true;
          }
          state.unavailable.delete(key);
          state.pending.delete(key);
        }
        const held = Object.keys(state.held);
        for (const key of held.slice(0, Math.max(0, held.length - MAX_HELD_STRINGS)))
          delete state.held[key];
        if (changed) setVersion((v) => v + 1);
      }
      // Whatever the pack did not contain is asked for now.
      if (state.pending.size > 0) schedule(code, 0);
    },
    [schedule],
  );

  const stateFor = useCallback(
    (code: string): RemoteState => {
      let state = remote.current[code];
      if (!state) {
        const cached = Object.keys(remote.current);
        if (cached.length >= MAX_CACHED_LANGUAGES) {
          const oldest = cached.find((candidate) => candidate !== activeLanguage.current);
          if (oldest) {
            delete remote.current[oldest];
            rendered.delete(oldest);
            const timer = timers.current.get(oldest);
            if (timer) clearTimeout(timer.handle);
            timers.current.delete(oldest);
          }
        }
        state = remoteState();
        remote.current[code] = state;
        if (typeof window !== "undefined") {
          const created = state;
          void fetchLanguagePack(code).then((pack) => applyPack(code, created, pack));
        }
      }
      return state;
    },
    [applyPack],
  );

  // While a language is shown, its pack is checked again now and then. The
  // request is revalidated with its ETag, so an unchanged pack costs a 304.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const language = getLanguage(lang);
    if (!language || language.code === DEFAULT_LANGUAGE || isSourceVariety(language)) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const state = remote.current[language.code];
      if (!state || state.refused) return;
      void fetchLanguagePack(language.code, state.packTag).then((pack) => {
        if (pack) applyPack(language.code, state, pack);
      });
    }, PACK_REFRESH_MS);
    return () => clearInterval(interval);
  }, [lang, applyPack]);

  /**
   * Send whatever has piled up for a language. Runs on a short timer so a
   * screenful of strings becomes one or two requests.
   */
  const drain = useCallback(
    (code: string) => {
      const state = remote.current[code];
      if (!state || state.refused || state.pending.size === 0) return;
      // The language pack usually answers everything; wait for it briefly.
      if (state.packUntil > Date.now()) {
        schedule(code, Math.min(200, state.packUntil - Date.now()));
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
        schedule(code, wait);
        return;
      }

      // Strings are kept as `context<separator>text`; one request carries one
      // context, and never more than the endpoint accepts from this caller.
      const limits = requestLimits();
      const maxItems = Math.min(BATCH, limits.maxItems);
      const first = state.pending.values().next().value as string;
      const context = first.slice(0, first.indexOf(SEPARATOR));
      const prefix = `${context}${SEPARATOR}`;
      const keys: string[] = [];
      let characters = 0;
      for (const entry of state.pending) {
        if (!entry.startsWith(prefix)) continue;
        const length = entry.slice(prefix.length).trim().length;
        if (length > limits.maxItemChars) {
          // Longer than one item may be: it would make the whole batch fail.
          // Shown in English, never sent.
          state.pending.delete(entry);
          state.refusedShape.add(entry);
          state.unavailable.add(entry);
          continue;
        }
        if (keys.length >= maxItems || characters + length > limits.maxTotalChars) break;
        keys.push(entry);
        characters += length;
      }
      if (keys.length === 0) {
        if (state.pending.size > 0) schedule(code, 0);
        return;
      }
      keys.forEach((entry) => {
        state.pending.delete(entry);
        state.inFlight.add(entry);
      });
      const batch = keys.map((entry) => entry.slice(prefix.length));

      void fetchTranslations(batch, code, context || null).then((outcome) => {
        for (const entry of keys) state.inFlight.delete(entry);
        const current = remote.current[code];
        if (!current || current !== state) return;

        if (outcome.refused) {
          current.refused = true;
          current.pending.clear();
          return;
        }
        const cacheKey = (text: string) => `${context}${SEPARATOR}${text}`;
        if (outcome.invalidRequest) {
          // Asking again would be refused the same way: these strings stay in
          // English for the visit instead of being re-sent every 30 seconds.
          for (const text of batch) {
            current.refusedShape.add(cacheKey(text));
            current.unavailable.add(cacheKey(text));
          }
          if (current.pending.size > 0) schedule(code, 200);
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

        let changed = false;
        for (const [source, translated] of Object.entries(outcome.translations)) {
          if (translated && translated !== current.held[cacheKey(source)]) {
            current.held[cacheKey(source)] = translated;
            changed = true;
          }
        }
        const held = Object.keys(current.held);
        for (const key of held.slice(0, Math.max(0, held.length - MAX_HELD_STRINGS)))
          delete current.held[key];
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

        if (changed || outcome.unavailable.length || outcome.retryAfter) {
          setVersion((v) => v + 1);
        }
        if (current.pending.size > 0) {
          schedule(code, Math.max(200, current.blockedUntil - Date.now()));
        }
      });
    },
    [schedule],
  );
  drainRef.current = drain;

  const translate = useCallback(
    (key: string, values?: MessageValues, options?: { context?: string }) => {
      const language = getLanguage(lang) ?? SOURCE_LANGUAGE_DEFINITION;
      const fill = (text: string) => (values ? formatMessage(text, values, language.code) : text);
      // What is shown in the visitor's language is remembered, so the page
      // translator never takes it for English source text (see isRendered).
      const shown = (text: string) => {
        const out = fill(text);
        if (typeof window !== "undefined") noteRendered(language.code, out, text);
        return out;
      };
      const english = sourceText(key);
      if (language.code === DEFAULT_LANGUAGE || isSourceVariety(language)) return fill(english);

      const exact = UI_DICTIONARY[language.code]?.[key];
      if (exact) return shown(exact);
      if (typeof window === "undefined") {
        const context = options?.context ?? messageContext(key) ?? "";
        return fill(
          remote.current[language.code]?.held[`${context}${SEPARATOR}${english}`] ?? english,
        );
      }
      // A product name is the same in every language (see src/lib/i18n/names.ts);
      // there is nothing to ask the server for.
      if (looksLikeProductName(english)) return fill(english);

      const context = options?.context ?? messageContext(key) ?? "";
      const cacheKey = `${context}${SEPARATOR}${english}`;
      const state = stateFor(language.code);
      const held = state.held[cacheKey];
      if (held) {
        state.fallback.delete(cacheKey);
        return shown(held);
      }
      state.fallback.add(cacheKey);

      if (
        !state.refused &&
        !state.pending.has(cacheKey) &&
        !state.inFlight.has(cacheKey) &&
        !state.unavailable.has(cacheKey) &&
        !state.refusedShape.has(cacheKey)
      ) {
        state.pending.add(cacheKey);
        schedule(language.code, 120);
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
    [lang, schedule, stateFor, version],
  );

  const value = useMemo<LanguageContextValue>(() => {
    const language = getLanguage(lang) ?? SOURCE_LANGUAGE_DEFINITION;
    return {
      translationState,
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
  }, [lang, setLanguage, translate, version, service, translationState]);

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
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange as EventListener);
    };
  }, []);
}

export function languageCount() {
  return LANGUAGES.length;
}
