import { createIsomorphicFn } from "@tanstack/react-start";
import { formatMessage } from "./format";
import { messageText, type MessageKey } from "./messages";
import { getLanguage } from "./registry";
import type { LanguageBootstrap } from "./bootstrap";

type HomeSeoInput = {
  data: { products: number | null; categories: number | null; bootstrap: LanguageBootstrap };
};

export function homeSeo(
  data: HomeSeoInput["data"],
  t: (key: MessageKey, values?: Record<string, string>) => string,
) {
  const language = data.bootstrap.code;
  const count = data.products?.toLocaleString(getLanguage(language)?.locale ?? "en-IN");
  const categories = data.categories?.toLocaleString(getLanguage(language)?.locale ?? "en-IN");
  return {
    language,
    title: count ? t("publicseo.home_title", { count }) : t("publicseo.home_generic_title"),
    description:
      count && categories
        ? t("publicseo.home_description", { count, categories })
        : t("publicseo.home_generic_description"),
    social: categories
      ? t("publicseo.home_social", { categories })
      : t("publicseo.home_social_generic"),
  };
}

export const getPublicHomeSeo = createIsomorphicFn()
  .server(async ({ data }: HomeSeoInput) => {
    const { serverTranslator } = await import("./server-translate.server");
    const t = await serverTranslator(data.bootstrap.code, ["publicseo"], { waitMs: 1500 });
    return homeSeo(data, t);
  })
  .client(async ({ data }: HomeSeoInput) =>
    homeSeo(data, (key, values) => {
      const source = messageText(key) ?? key;
      const text = data.bootstrap.entries[`publicseo${String.fromCharCode(1)}${source}`] ?? source;
      return values ? formatMessage(text, values, data.bootstrap.code) : text;
    }),
  );
