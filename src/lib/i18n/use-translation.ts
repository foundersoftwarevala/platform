import { Fragment, createElement, useCallback, useMemo, type ReactNode } from "react";

import { useLanguage } from "@/lib/language-catalog";
import { formatCurrency, formatDate, formatNumber, type MessageValues } from "./format";
import { messageContext, type MessageKey } from "./messages";

/**
 * The one way interface code asks for text.
 *
 *   const { t } = useTranslation();
 *   t("checkout.pay_now")
 *   t("account.orders_count", { count })          // ICU plural / variables
 *   t("common.close", undefined, "chat")           // same key, another context
 *
 * Keys live in src/lib/i18n/messages/<module>.ts (English only). The text
 * comes, in order, from the reviewed dictionary, translation memory (the
 * language pack and the in-page cache), and the platform's own engine; until
 * a translation exists the English source is shown. Nothing is invented and
 * rendering never waits for the network.
 *
 * `context` overrides where the string is said to appear. By default it is the
 * key's module, which is what translation memory and the review queue are
 * keyed by.
 *
 * Numbers, money and dates go through the same hook so they follow the
 * language too: formatCurrency(1299, "INR"), formatDate(order.created_at).
 */
export function useTranslation() {
  const { translate, lang, language, dir, setLanguage, serviceReady } = useLanguage();
  const t = useCallback(
    (key: MessageKey, variables?: MessageValues, context?: string) =>
      translate(key, variables, { context: context ?? messageContext(key) }),
    [translate],
  );
  const formats = useMemo(
    () => ({
      formatNumber: (value: number, style?: string) => formatNumber(value, language, style),
      formatCurrency: (value: number, currency: string) =>
        formatCurrency(value, currency, language),
      formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, language, options),
    }),
    [language],
  );
  return { t, lang, language, dir, setLanguage, serviceReady, ...formats };
}

export type Translate = ReturnType<typeof useTranslation>["t"];

/**
 * A translated sentence with elements in it: t() without variables keeps the
 * {placeholders}, and this puts a React node at each one, so the sentence is
 * translated whole and the translation decides where the element goes.
 *
 *   richText(t("auth.welcome_back"), { name: <strong>{name}</strong> })
 */
export function richText(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((piece, index) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return createElement(Fragment, { key: index }, name && name in parts ? parts[name] : piece);
  });
}

/**
 * t() as an element, for markup that cannot call a hook where the text is
 * (expression-bodied components such as the src/components/ui primitives).
 * Same key, variables, context and sources as t().
 */
export function Msg({
  k,
  values,
  context,
}: {
  k: MessageKey;
  values?: MessageValues;
  context?: string;
}) {
  const { t } = useTranslation();
  return createElement(Fragment, null, t(k, values, context));
}
