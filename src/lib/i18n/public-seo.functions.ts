import { createIsomorphicFn } from "@tanstack/react-start";
import { formatMessage, formatNumber } from "./format";
import { messageText, type MessageKey } from "./messages";
import type { LanguageBootstrap } from "./bootstrap";

type HomeSeoInput = {
  data: {
    products: number | null;
    categories: number | null;
    liveDemos?: number | null;
    bootstrap: LanguageBootstrap;
  };
};

export function homeSeo(
  data: HomeSeoInput["data"],
  t: (key: MessageKey, values?: Record<string, string>) => string,
) {
  const language = data.bootstrap.code;
  const formattedCounts = Object.fromEntries(
    [data.products, data.categories, data.liveDemos]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => [value, formatNumber(value, language)]),
  );
  const count = data.products === null ? undefined : formattedCounts[data.products];
  const categories = data.categories === null ? undefined : formattedCounts[data.categories];
  return {
    language,
    formattedCounts,
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
