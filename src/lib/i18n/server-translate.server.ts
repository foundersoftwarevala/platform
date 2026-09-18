import { formatMessage, type MessageValues } from "./format";
import { LANGUAGE_COOKIE, detectBrowserLanguage } from "./language-service";
import { allMessages, messageContext, messageText, type MessageKey } from "./messages";
import { PipelineError } from "./pipeline";
import { SOURCE_LANGUAGE, resolveLanguage } from "./registry";
import { log, translateForCaller } from "./service.server";

/**
 * t() for code that runs on the server: e-mails, notifications, messages an
 * API sends back for a person to read.
 *
 *   const t = await serverTranslator(languageOf(request), ["email"]);
 *   t("email.licence_heading")
 *
 * It uses the same catalogue (src/lib/i18n/messages), the same pipeline
 * (translation memory, glossary, the platform's own engine, the quality gate)
 * and the same memory rows as the pages, so a string translated for a page is
 * not translated again for an e-mail.
 *
 * It never blocks longer than `waitMs`: whatever is not translated by then is
 * given in English (and the translation carries on and is kept for the next
 * time). Nothing is invented: a string is either a translation the pipeline
 * accepted or its English source.
 */

/** Separates context and text in lookup keys, as the page and the pack do. */
const SEP = String.fromCharCode(1);

export type ServerT = (key: MessageKey, variables?: MessageValues) => string;

const SERVER_CALLER = {
  tier: "operator" as const,
  subject: "internal:server-translate",
  userId: null,
};

/** How long a server translation may hold up the work it is part of. */
const DEFAULT_WAIT_MS = 15_000;

/** English, formatted: what every server translator falls back to. */
export function englishTranslator(): ServerT {
  return (key, variables) => {
    const text = messageText(key) ?? key;
    return variables ? formatMessage(text, variables, "en") : text;
  };
}

/**
 * The language a request asks for: the site's language cookie (the language the
 * visitor chose or that was detected for them), then Accept-Language, then English.
 */
export function languageOf(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]+)`));
  if (match) {
    const chosen = resolveLanguage(decodeURIComponent(match[1]!));
    if (chosen) return chosen.code;
  }
  const accept = request.headers.get("accept-language") ?? "";
  const preferences = accept
    .split(",")
    .map((part) => part.split(";")[0]!.trim())
    .filter(Boolean);
  return (
    detectBrowserLanguage({ languages: preferences, language: preferences[0] ?? "" }) ??
    SOURCE_LANGUAGE
  );
}

/**
 * Translate every message of the given modules ("email", "checkout", ...) into
 * `lang`, in one pipeline call per module, and return a synchronous t().
 */
export async function serverTranslator(
  lang: string | null | undefined,
  modules: readonly string[],
  options: { waitMs?: number } = {},
): Promise<ServerT> {
  const english = englishTranslator();
  const language = resolveLanguage(lang ?? "");
  if (!language || language.code === SOURCE_LANGUAGE) return english;

  const wanted = allMessages().filter((m) => modules.includes(m.context));
  const byContext = new Map<string, string[]>();
  for (const m of wanted) byContext.set(m.context, [...(byContext.get(m.context) ?? []), m.text]);

  const translated = new Map<string, string>();
  const work = Promise.all(
    [...byContext.entries()].map(async ([context, texts]) => {
      try {
        const result = await translateForCaller(
          {
            texts,
            source: SOURCE_LANGUAGE,
            target: language.code,
            namespace: "ui",
            context,
            persist: true,
          },
          SERVER_CALLER,
        );
        for (const outcome of result.outcomes) {
          if (
            outcome.translation &&
            (outcome.status === "machine" || outcome.status === "verified")
          ) {
            translated.set(`${context}${SEP}${outcome.text}`, outcome.translation);
          }
        }
      } catch (error) {
        log(
          "[i18n] server translation fell back to English",
          error instanceof PipelineError ? `${error.reason}: ${error.message}` : error,
        );
      }
    }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    work,
    new Promise((resolve) => {
      timer = setTimeout(resolve, options.waitMs ?? DEFAULT_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);

  return (key, variables) => {
    const text = messageText(key) ?? key;
    const found = translated.get(`${messageContext(key) ?? ""}${SEP}${text}`) ?? text;
    return variables ? formatMessage(found, variables, language.code) : found;
  };
}
