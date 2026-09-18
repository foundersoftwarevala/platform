# The language system

One registry, one language service, one translation pipeline, one engine
interface. 140 languages, translated by the platform's own engine.

```
 UI:  t("Apply Now")                      useLanguage() in language-catalog.ts
        |                                    1. reviewed dictionary (ui-dictionary.ts)
        |                                    2. strings already received (localStorage)
        |                                    3. the language's fallback chain
        v                                    4. English, while it waits
 POST /api/marketplace/translate          routes/api/marketplace/translate.ts
        |                                    caller tier, rate limit, size limits
        v
 pipeline.ts                              resolve languages -> translation memory
        |                                  -> glossary -> engine -> validate -> store
        v
 engine/engine.ts                         provider-independent
        |
        +-- owned-engine   (services/translation-engine, MADLAD-400 + LibreTranslate)
        +-- ai-api-manager (external; only with TRANSLATION_ALLOW_EXTERNAL=true)
```

## Files

| File | What it is |
|---|---|
| `registry.ts` | The 140 supported languages and 5 retired ones: codes, scripts, direction, formatting and plural locales, fallback chains, aliases, old catalogue codes. Everything resolves through `resolveLanguage`. |
| `language-service.ts` | The visitor's language: get, set, validate, detect from the browser, persist (localStorage + cookie), write `<html lang dir>`, and the pre-paint boot script. |
| `ui-dictionary.ts` | Reviewed interface text. `en` is the source catalogue; 11 other languages are partly covered. |
| `format.ts` | ICU messages (plural, selectordinal, select, `#`, offset) and Intl number/date/currency formatting per language. |
| `pipeline.ts` | The translation pipeline. Pure; every dependency is injected. |
| `engine/` | The provider interface, the engine that picks a provider, and the two adapters. |
| `glossary.ts`, `quality.ts`, `hash.ts` | Terminology protection, output validation, memory keys. |
| `limits.ts` | Caller tiers (anonymous, user, operator) and their limits. |
| `service.server.ts` | Server wiring: Supabase-backed memory and glossary, quota, caller resolution. |
| `jobs.server.ts` | Background translation: enqueue the catalogue, claim and work jobs. |
| `admin.server.ts` | What the Language Manager console reads and changes. |
| `../language-catalog.ts` | `<LanguageProvider>` and `useLanguage()`, the interface the application uses. |

## Using it

```tsx
const { translate: t, lang, language, dir, setLanguage } = useLanguage();

t("Apply Now");                                    // reviewed text, memory, or English
t("You have {count, plural, one {# item} other {# items}}", { count: 3 });
t("Open", undefined, { context: "product card action" });  // same word, different place
setLanguage("pt-BR");                              // any spelling the registry knows
formatCurrency(249, "USD", language);
```

Rules of the road:

- Never keep a second list of languages. Read `SUPPORTED_LANGUAGES` from the
  registry.
- Never send a language code straight to a model or a database. Resolve it
  first; an unknown code is refused.
- Text that failed validation is never shown. A segment comes back with no
  translation and its reasons, and the caller shows the fallback.
- Private text (chat) is translated with `persist: false`: it is never read
  from or written to shared translation memory.

## Database

- `i18n_languages` — the registry, mirrored (a test compares the two).
- `marketplace_translations` — translation memory: source and target language,
  context, status (`machine`, `verified`, `needs_review`, `rejected`, `legacy`,
  `stale`), quality score, engine, version. A trigger stops automatic writes
  from replacing what a person decided, and records every change in
  `i18n_translation_revisions`.
- `i18n_glossary_terms` — locked, preferred and forbidden terms.
- `i18n_translation_jobs` — the background queue, claimed with SKIP LOCKED.
- `i18n_request_quota` + `i18n_consume_quota()` — cost control across instances.

## Environment

| Variable | Meaning |
|---|---|
| `TRANSLATE_PROVIDER_URL` | The platform's engine, e.g. `http://127.0.0.1:5100/v1/translate`. |
| `TRANSLATE_PROVIDER_TOKEN` | Bearer token for it. |
| `TRANSLATION_ALLOW_EXTERNAL` | `true` also allows the external AI API Manager adapter. Off by default. |
| `TRANSLATION_PROVIDER_ORDER` | Provider order; default `owned-engine,ai-api-manager`. |
| `I18N_JOB_WORKER` | `off` stops this instance from working the job queue. |

## Operating

`/language-manager` (admin or boss) shows the engine's state, what memory holds
per language, the review queue, the glossary and the job queue, and can
pre-translate the catalogue into any language.

`POST /api/i18n/jobs` with `x-internal-token` runs one batch, for a scheduler.
The application also works the queue on a timer inside the server process.

### When the engine is busy

`engine_unavailable` (HTTP 503) means the engine did not answer this time: not
configured, busy with other work, or restarting. The page does not give up on
it: the batch is asked again after 15 s, 30 s, 60 s, 120 s, 240 s, then every
five minutes (`engineBackoffSeconds` in `src/lib/language-catalog.ts`), and the
first successful answer clears the state. Nothing is shown in its place but the
language's fallback and English.

### First visit in a cold language

The engine is one CPU-bound model on one host, so the first visitor in a
language that nothing has been translated into yet waits for the whole page to
be translated segment by segment. Pre-translating that language first — the
Language Manager's "pre-translate" action, or `enqueue_texts` with the strings
the page shows — fills translation memory, and every later visit is then served
from memory. Languages the second local backend (LibreTranslate/Argos) covers
are fast enough without it; the ones it does not cover, such as Divehi, should
be pre-translated before they are offered.

### One server process per port

Translation memory and the job queue are shared, and every instance runs the
job worker on a timer unless `I18N_JOB_WORKER=off`. Two instances of the same
application therefore both work the queue, and if an older instance keeps the
port after a restart, requests are still served by the old build. After a
deploy, check that the process manager's own process is the one listening
(`pm2 jlist` pid against `ss -ltnp`) and that no earlier process survived.
