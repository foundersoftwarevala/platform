# Translation System — Developer Guide

Every user-facing string in Software Vala goes through one system: one
catalogue, one API, one pipeline, one registry of 140 languages. This page is
all you need to add a screen that works in every language.

## In a component

```tsx
import { useTranslation } from "@/lib/i18n/use-translation";

export function OrdersPanel({ count }: { count: number }) {
  const { t, formatCurrency, formatDate } = useTranslation();
  return (
    <section aria-label={t("orders.panel_label")}>
      <h2>{t("orders.title")}</h2>
      <p>{t("orders.count", { count })}</p>
      <p>{formatCurrency(1299, "INR")} · {formatDate(new Date())}</p>
    </section>
  );
}
```

and the English, in `src/lib/i18n/messages/orders.ts`:

```ts
export const ORDERS_MESSAGES = {
  "orders.title": ["Orders", "heading of the orders panel (noun)"],
  "orders.panel_label": "Your orders",
  "orders.count": "{count, plural, one {# order} other {# orders}}",
} as const;
```

Add the module to `MODULES` in `src/lib/i18n/messages/index.ts`. That is all.
The key is typed: a key that does not exist does not compile.

`t(key)`, `t(key, variables)`, `t(key, variables, context)`:

- **variables** are ICU MessageFormat: `{name}`, `{count, plural, one {…} other {…}}`,
  `{status, select, paid {…} other {…}}`. Write whole sentences with
  variables in them; never glue translated pieces together (word order
  differs between languages).
- **context** defaults to the key's module. Pass another only when the same
  key is shown somewhere with a different meaning.
- A sentence with an element inside it (a link, a bold name):
  `richText(t("account.setup_note"), { link: <a href="/support">…</a> })` with
  `"… Questions? {link}."` in the catalogue.
- Where a hook cannot be called (expression-bodied `forwardRef` components):
  `<Msg k="common.close" />` is the same `t()` as an element.
- Numbers, money and dates: `formatNumber`, `formatCurrency`, `formatDate` from
  the same hook follow the language.

Rules for catalogue entries: English only; keys are `module.words_with_underscores`;
add a description (`["text", "description"]`) when a reviewer could read the
text two ways (a verb or a noun, a button or a heading).

## On the server (e-mails, notifications, API messages people read)

```ts
import { languageOf, serverTranslator } from "@/lib/i18n/server-translate.server";

const lang = languageOf(request);                 // sv_locale cookie, then Accept-Language
const t = await serverTranslator(lang, ["email"], { waitMs: 4000 });
t("email.licence.heading");
```

Same catalogue, same memory, same pipeline. It waits at most `waitMs` (15 s by
default); whatever is not translated by then is sent in English. When the
work happens later than the request (a payment callback, a job), store the
language with the record while you still have the request, as
`/api/payment/initiate` does on the order (`metadata.language`).

## What happens to a string

```
t("orders.count", { count })
  → reviewed dictionary (ui-dictionary.ts)
  → language pack (/api/i18n/pack: one request per language, cached, ETag)
  → in-page cache (and localStorage)
  → otherwise: batched request to /api/marketplace/translate (36 strings, one per context)
       → translation memory (exact source + context; verified before machine)
       → glossary (brand names locked, approved terminology)
       → the platform's own engine (MADLAD-400; placeholders, HTML, URLs,
         e-mail addresses, currency codes and amounts, SKUs and codes protected;
         ICU plurals generated per language)
       → quality gate (script, language, placeholders, terminology)
       → memory (write-through cache) → pack → page
```

Until a translation exists the English source is shown. Rendering never waits
for the network, and nothing is ever invented: a string is either a
translation that passed the gate, or English.

New keys are translated before anyone asks: when the application starts, the
job worker queues every catalogue message for every language that memory does
not hold (`syncMessageCatalogue`, ahead of other background work). A message
whose English changed gets a new translation; the old one is marked `stale`.

## Things that must not be translated

- Brand and product names: add them to the glossary as `locked` (Language
  Manager → Glossary). "Software Vala" already is.
- Code, sample data, language names: mark the element `translate="no"` or
  `data-no-translate`.
- A literal the audit should ignore (it is not user text): an
  `// i18n-ignore` comment on the line or the line above, with the reason.

## Checks (CI)

```
npm run i18n:check      # fails on any problem below
npm run i18n:audit      # coverage by module
```

`i18n:check` fails when

- a file has more hardcoded user-facing text (JSX text, text in `?:`/`&&`,
  placeholder/title/alt/aria-label, toasts, alerts, API `error:` messages) than
  in `scripts/i18n-baseline.json` — existing text can move to `t()` at any
  pace, new hardcoded text cannot be added;
- a key is used that the catalogue does not have, or appears twice;
- `t()` leaves out a variable the message needs, or passes one it does not use;
- a message is not valid ICU (unbalanced braces, plural without `other`, …) or
  is not English;
- a language code in the code is not in the registry.

After moving text to `t()`, lower the baseline with `npm run i18n:baseline` and
commit it. Never raise it to make the check pass.

## Review

Language Manager → Review (admins and the boss). Every translation shows its
source, language, module (context), origin (engine or reviewer), quality score
and flags.

| Status | Served | Meaning |
|---|---|---|
| machine | yes | passed the quality gate |
| needs_review | no (English shown) | failed the gate, waiting for a person |
| verified | yes, preferred | approved by a person; automatic writes never change it |
| rejected | no | refused by a person |
| stale | no | re-translation requested, or the English changed |

Actions: **Verify** (approve; an edit is saved as the reviewer's text),
**Reject**, **Reopen**, **Re-translate** (not for verified rows), **Lock**
(approve and make it the language's required term wherever that English
appears; short strings only).

## The language selector

There is one: `src/components/i18n/LanguageSelector.tsx`. Every screen has it,
either inline or as the floating button the root layout mounts
(`LanguageDock`), which shows only while no inline selector is on screen. So
a new page needs nothing to get language switching. To put it in a header:

```tsx
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

<LanguageSelector />                    // themed button with the language's name
<LanguageSelector showName={false} />   // compact: globe + code
<LanguageSelector variant="dark" />     // on dark headers
```

It lists the 140 registry languages A–Z by English name, with the language's
own name, letter headings, a letter bar and search (English name, own name,
code; accents ignored). The current and browser languages are pinned on top.
Keyboard: type, arrows, Enter. The choice is stored, sets `<html lang dir>`
and re-renders every `t()`. Never build another language list or picker: use
this component, or `SUPPORTED_LANGUAGES` from the registry for data.

## Languages, SEO, accessibility

- The 140 languages are `src/lib/i18n/registry.ts`; nothing else lists
  languages. Use `SUPPORTED_LANGUAGES` / `getLanguage()`.
- `<html lang dir>` is set before first paint from the stored or browser
  language. Right-to-left languages get `dir="rtl"`.
- The language is a visitor preference, not part of the URL: each page has one
  URL and one canonical, so there are no per-language URLs to list in
  `hreflang` (adding hreflang pointing at the same URL would be incorrect).
  The page title and the ARIA attributes are translated in the page.

## Older code

Most screens predate this API and are translated in the browser by the page
translator (`src/components/i18n/PageTranslator.tsx`), which sends visible text
through the same pipeline with no context. It skips anything `t()` rendered.
Some older components call `useLanguage().translate("English wording")`; it is
the same provider underneath. New code uses `useTranslation()` only; when you
touch an older screen, move its text to the catalogue.
