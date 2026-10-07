import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { languagePackPayload, type LanguageBootstrap } from "./bootstrap";
import { getCurrentLanguage } from "./language-service";
import { resolveLanguage } from "./registry";

export const getLanguageBootstrap = createIsomorphicFn()
  .server(async (): Promise<LanguageBootstrap> => {
    const { languageOf } = await import("./server-translate.server");
    const { SOURCE_LANGUAGE, getLanguage } = await import("./registry");
    const request = getRequest();
    const code = languageOf(request);
    const empty: LanguageBootstrap = {
      code,
      entries: {},
      withheld: [],
      locked: [],
      tag: null,
      reason: null,
    };
    if (getLanguage(code)?.iso639_3 === getLanguage(SOURCE_LANGUAGE)?.iso639_3) return empty;
    const { db, disabledLanguages, languagePack, log } = await import("./service.server");
    try {
      if ((await disabledLanguages(await db())).has(code)) {
        return { ...empty, code: SOURCE_LANGUAGE, reason: "language_disabled" };
      }
      const pack = await languagePack(code);
      const body = languagePackPayload.parse(JSON.parse(pack.body));
      return {
        ...empty,
        entries: body.entries,
        withheld: body.withheld,
        locked: body.locked,
        tag: pack.etag,
      };
    } catch (error) {
      log(
        "[i18n] native SSR pack unavailable",
        error instanceof Error ? error.message : "request error",
      );
      return { ...empty, reason: "language_pack_unavailable" };
    }
  })
  .client(async (): Promise<LanguageBootstrap> => {
    const code =
      resolveLanguage(new URL(window.location.href).searchParams.get("lang") ?? "")?.code ??
      getCurrentLanguage();
    const empty: LanguageBootstrap = {
      code,
      entries: {},
      withheld: [],
      locked: [],
      tag: null,
      reason: null,
    };
    if (resolveLanguage(code)?.iso639_3 === "eng") return empty;
    try {
      const response = await fetch(`/api/i18n/pack?lang=${encodeURIComponent(code)}`, {
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();
      if (response.status === 400 && body.reason === "language_disabled")
        return { ...empty, code: "en", reason: "language_disabled" };
      if (!response.ok) throw new Error(`Native language pack HTTP ${response.status}`);
      const pack = languagePackPayload.parse(body);
      return { ...empty, ...pack, tag: response.headers.get("etag") };
    } catch (error) {
      console.error("[i18n] native navigation pack unavailable", error);
      return { ...empty, reason: "language_pack_unavailable" };
    }
  });
