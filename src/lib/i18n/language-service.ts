import {
  LANGUAGE_REGISTRY,
  SOURCE_LANGUAGE,
  getFallbackChain,
  getLanguage,
  resolveLanguage,
  type LanguageDefinition,
} from "./registry";

/**
 * The visitor's language.
 *
 * One place decides which language is current, stores it, detects it from the
 * browser, and writes it to <html lang dir>. The language provider, the
 * pickers and the boot script all go through here, so there is one answer to
 * "which language is this page in".
 *
 * Browser objects are passed in rather than read from globals so the rules can
 * be tested without a browser; every function defaults to the real ones.
 */

/** Where the chosen language is kept. Values are canonical registry codes. */
export const LANGUAGE_STORAGE_KEY = "sv_lang_current_v2";

/**
 * The previous key. Its values are old catalogue codes ("AM" for Armenian,
 * "AR5" for Spanish in Argentina). It is read once, translated through the
 * legacy map, and left in place untouched.
 */
export const LEGACY_LANGUAGE_STORAGE_KEY = "sv_lang_current_v1";

/** Mirrors the choice for the server, so a request can know it too. */
export const LANGUAGE_COOKIE = "sv_locale";

/** Fired on window whenever the language changes. `detail` is the code. */
export const LANGUAGE_CHANGE_EVENT = "sv:lang-change";

export const DEFAULT_LANGUAGE = SOURCE_LANGUAGE;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type NavigatorLike = { language?: string; languages?: readonly string[] };
type DocumentLike = {
  documentElement: {
    lang: string;
    dir: string;
    setAttribute(name: string, value: string): void;
  };
  cookie?: string;
};

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserNavigator(): NavigatorLike | null {
  return typeof navigator === "undefined" ? null : navigator;
}

function browserDocument(): DocumentLike | null {
  return typeof document === "undefined" ? null : document;
}

/** Canonical code for any input, or null. See resolveLanguage for what is accepted. */
export function normalizeLanguage(input: string | null | undefined): string | null {
  return resolveLanguage(input)?.code ?? null;
}

export function validateLanguage(input: string | null | undefined): boolean {
  return normalizeLanguage(input) !== null;
}

/**
 * The first supported language in the browser's preference list.
 *
 * Regional preferences are kept when the registry has that variant ("pt-BR",
 * "es-MX", "zh-TW" -> "zh-Hant") and fall back to the base language when it
 * does not ("pt-AO" -> "pt").
 */
export function detectBrowserLanguage(
  nav: NavigatorLike | null = browserNavigator(),
): string | null {
  if (!nav) return null;
  const preferences = [...(nav.languages ?? []), nav.language].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const preference of preferences) {
    const code = normalizeLanguage(preference);
    if (code) return code;
  }
  return null;
}

/** The stored choice, migrating a value written by the previous catalogue. */
export function readStoredLanguage(storage: StorageLike | null = browserStorage()): string | null {
  if (!storage) return null;
  try {
    const current = normalizeLanguage(storage.getItem(LANGUAGE_STORAGE_KEY));
    if (current) return current;

    const legacy = storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
    const migrated = resolveLanguage(legacy, { legacy: true })?.code ?? null;
    if (migrated) storage.setItem(LANGUAGE_STORAGE_KEY, migrated);
    return migrated;
  } catch {
    return null;
  }
}

/** Stored choice, else browser preference, else the source language. */
export function getCurrentLanguage(
  storage: StorageLike | null = browserStorage(),
  nav: NavigatorLike | null = browserNavigator(),
): string {
  return readStoredLanguage(storage) ?? detectBrowserLanguage(nav) ?? DEFAULT_LANGUAGE;
}

export function getCurrentLanguageDefinition(): LanguageDefinition {
  return getLanguage(getCurrentLanguage()) ?? getLanguage(DEFAULT_LANGUAGE)!;
}

/** Write <html lang dir data-lang> for a language. */
export function applyDocumentLanguage(code: string, doc: DocumentLike | null = browserDocument()) {
  if (!doc) return;
  const language = resolveLanguage(code) ?? getLanguage(DEFAULT_LANGUAGE)!;
  doc.documentElement.lang = language.code;
  doc.documentElement.dir = language.direction;
  doc.documentElement.setAttribute("data-lang", language.code);
}

function writeCookie(code: string, doc: DocumentLike | null) {
  if (!doc || typeof doc.cookie !== "string") return;
  try {
    doc.cookie = `${LANGUAGE_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* cookies disabled */
  }
}

/**
 * Choose a language.
 *
 * Returns the canonical code that was applied, or null when the input is not a
 * supported language - in which case nothing changes.
 */
export function setCurrentLanguage(
  input: string,
  env: {
    storage?: StorageLike | null;
    doc?: DocumentLike | null;
    target?: EventTarget | null;
  } = {},
): string | null {
  const code = normalizeLanguage(input);
  if (!code) return null;
  const storage = env.storage === undefined ? browserStorage() : env.storage;
  const doc = env.doc === undefined ? browserDocument() : env.doc;
  const target =
    env.target === undefined ? (typeof window === "undefined" ? null : window) : env.target;

  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* a full or blocked store still lets the page switch */
  }
  writeCookie(code, doc);
  applyDocumentLanguage(code, doc);
  if (target && typeof CustomEvent !== "undefined") {
    target.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: code }));
  }
  return code;
}

export { getFallbackChain };

/**
 * A script for <head> that sets <html lang dir> from the stored choice before
 * the page paints, so a right-to-left visitor never sees a left-to-right
 * flash. It carries only the codes it needs; the full resolution rules run
 * once the application loads.
 */
export function buildLanguageBootScript(): string {
  const rtl: string[] = [];
  const legacy: Record<string, string> = {};
  const codes: Record<string, string> = {};
  for (const language of LANGUAGE_REGISTRY) {
    if (!language.enabled) {
      // A retired language's old code opens the language that replaced it.
      if (language.legacyCode && language.replacedBy)
        legacy[language.legacyCode] = language.replacedBy;
      continue;
    }
    const code = language.code;
    codes[code.toLowerCase()] = code;
    if (language.direction === "rtl") rtl.push(code);
    if (language.legacyCode) legacy[language.legacyCode] = code;
  }
  const payload = JSON.stringify({
    k: LANGUAGE_STORAGE_KEY,
    l: LEGACY_LANGUAGE_STORAGE_KEY,
    c: codes,
    g: legacy,
    r: rtl,
  });
  return (
    `(function(){try{var d=${payload};var s=localStorage;` +
    `var v=s.getItem(d.k);var c=v&&d.c[String(v).toLowerCase()];` +
    `if(!c){var o=s.getItem(d.l);c=o&&d.g[String(o).toUpperCase()];}` +
    `if(!c)return;var e=document.documentElement;e.lang=c;` +
    `e.dir=d.r.indexOf(c)>=0?"rtl":"ltr";e.setAttribute("data-lang",c);}catch(x){}})();`
  ).replace(/</g, "\\u003c");
}
