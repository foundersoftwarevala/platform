/**
 * The keyed message catalogue: the English source for every string the
 * application asks for with t("module.key").
 *
 * One file per module (auth.ts, checkout.ts, chat.ts, ...). A module file
 * exports one object whose keys all start with the module's name; that prefix
 * is the context the string is translated in, so "Close" in the chat and
 * "Close" on an order can be translated differently and reviewed apart.
 *
 * A value is either the English text, or [text, description] when a reviewer
 * needs to know more than the key says ("Order" as a noun, a button that
 * submits payment). The description is shown in the review queue; it is not
 * part of the context, so a screen's strings still travel in one request.
 *
 * Text is ICU MessageFormat: {name} for a variable,
 * {count, plural, one {# item} other {# items}} for a plural,
 * {kind, select, card {...} other {...}} for a choice. Variables are filled
 * after translation, so the translation keeps the placeholders.
 *
 * Nothing but English lives here. Translations come from translation memory,
 * the reviewed dictionary and the platform's own engine; never write another
 * language into this catalogue.
 *
 * Adding a module: create messages/<module>.ts, add it to MODULES below, then
 * use t("<module>.<key>") through useTranslation(). `npm run i18n:check`
 * validates keys, variables and ICU syntax.
 */
import { ACCOUNT_MESSAGES } from "./account";
import { AUTH_MESSAGES } from "./auth";
import { CHAT_MESSAGES } from "./chat";
import { CHECKOUT_MESSAGES } from "./checkout";
import { COMMON_MESSAGES } from "./common";
import { EMAIL_MESSAGES } from "./email";
import { PAYMENT_MESSAGES } from "./payment";

export type MessageSource = string | readonly [text: string, description: string];

export const MODULES = {
  account: ACCOUNT_MESSAGES,
  auth: AUTH_MESSAGES,
  chat: CHAT_MESSAGES,
  checkout: CHECKOUT_MESSAGES,
  common: COMMON_MESSAGES,
  email: EMAIL_MESSAGES,
  payment: PAYMENT_MESSAGES,
} as const;

type Modules = typeof MODULES;
/** Every key in the catalogue, e.g. "checkout.pay_now". */
export type MessageKey = { [M in keyof Modules]: keyof Modules[M] & string }[keyof Modules];

type Entry = { text: string; context: string; description: string };

const ENTRIES: ReadonlyMap<string, Entry> = (() => {
  const map = new Map<string, Entry>();
  for (const [module, messages] of Object.entries(MODULES)) {
    for (const [key, value] of Object.entries(messages as Record<string, MessageSource>)) {
      const [text, description] = typeof value === "string" ? [value, ""] : value;
      map.set(key, { text, context: module, description });
    }
  }
  return map;
})();

/** True when `key` is a catalogue key ("auth.sign_in"), not free text. */
export function isMessageKey(key: string): key is MessageKey {
  return ENTRIES.has(key);
}

/** English source text of a key, or undefined when the catalogue has no such key. */
export function messageText(key: string): string | undefined {
  return ENTRIES.get(key)?.text;
}

/** The context a key is translated in: its module. */
export function messageContext(key: string): string | undefined {
  return ENTRIES.get(key)?.context;
}

/** Every entry. Used by the catalogue sync, the review queue and the checks. */
export function allMessages(): {
  key: string;
  text: string;
  context: string;
  description: string;
}[] {
  return [...ENTRIES.entries()].map(([key, entry]) => ({ key, ...entry }));
}
