# The language system

One registry, one language service, one translation pipeline, one engine
interface. 140 languages, translated by the platform's own engine.

```
 UI:  t("Apply Now")                      useLanguage() in language-catalog.ts
        |                                    1. reviewed dictionary (ui-dictionary.ts)
        |                                    2. strings already received (localStorage)
        |                                    3. the language's fallback chain
        v                                    4. English, while it waits
 GET  /api/i18n/pack?lang=xx              routes/api/i18n/pack.ts (once per language)
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
| `service.server.ts` | Server wiring: Supabase-backed memory and glossary (cached in the process), quota, caller resolution, language packs. |
| `hot-cache.ts` | The TTL/LRU cache and single-flight used on the translate path. |
| `metrics.server.ts` | Request, latency, cache and process measurements for the metrics view. |
| `names.ts` | Recognises product names, which are not translated (shared by server and browser). |
| `jobs.server.ts` | Background translation: enqueue, claim and work jobs; the worker starts with the server, yields when the host is busy, and prunes old rows hourly. |
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
| `I18N_JOB_MAX_LOAD` | Load average above which background translation pauses (default 80 % of the CPUs). |

## Operating

`/language-manager` (admin or boss) shows the engine's state, what memory holds
per language, the review queue, the glossary and the job queue, and can
pre-translate the catalogue into any language.

`POST /api/i18n/jobs` with `x-internal-token` runs one batch, for a scheduler.
The application works the queue inside the server process, batch after batch
while there is work, pausing when the host's load average is above 80 % of its
CPUs (`I18N_JOB_MAX_LOAD`).

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
job worker (started with the server) unless `I18N_JOB_WORKER=off`. Two instances of the same
application therefore both work the queue, and if an older instance keeps the
port after a restart, requests are still served by the old build. After a
deploy, check that the process manager's own process is the one listening
(`pm2 jlist` pid against `ss -ltnp`) and that no earlier process survived.

## Serving at volume

A page shown in a language other than English costs, on the server:

1. `GET /api/i18n/pack?lang=xx` - every interface string memory holds for the
   language, plus the strings held for review (`withheld`) and the locked brand
   names (`locked`). Built from the database once per five minutes and
   language, kept in the process, served with `Cache-Control: public,
   max-age=300` and an ETag (304 on repeat).
2. `POST /api/marketplace/translate` for what the pack did not contain, in
   batches of 36. Product names and brand-only strings are answered in the
   browser and never sent; text already in another script is not source text
   and is never sent back.

On the server the translate path reads translation memory, the glossary and
the caller from in-process caches (`src/lib/i18n/hot-cache.ts`): the database
is about 280 ms away from the production host, and without them a cached page
batch took 0.9 s and the endpoint stopped near 10 requests a second. Engine
quota is decided in the process and written to the database in the background.

Measured on the production host (2 vCPU, shared with the engine, the site and
the load generator), 20-second runs:

| Path | Requests/s | p50 | p99 |
|---|---|---|---|
| language pack, 50 connections | 1,224 | 33 ms | 89 ms |
| batch of 36 strings from memory, 50 connections | 260 | 151 ms | 351 ms |
| strings the engine has cached, 200 connections | 318 | 565 ms | 2.1 s |
| before the caches: batch of 36 from memory, 25 connections | 9.5 | 2.4 s | 3.6 s |

79,924 requests in the final run made 66 database calls. A warm page view in
Hebrew makes one pack request and two or three small batches.

What does not scale with traffic is new text: the engine translates about
10 characters a second in quality mode on 1.5 CPUs (0.5 short strings a
second), so text is pre-translated through the job queue rather than on the
first visit. When one host is not enough, the engine moves to its own machine
(the application reaches it over HTTP, `TRANSLATE_PROVIDER_URL`), further
engines work the same queue (claims are leases taken with SKIP LOCKED), and if
the application itself runs as several processes the in-process caches move
to a shared cache.

## Monitoring, backups and recovery

* `GET /api/i18n/admin?view=metrics` (operators, or `x-internal-token`):
  requests per second, p50/p95/p99 per endpoint and for the engine and each
  database call, cache hit ratios, queue depth, database latency, engine
  readiness and counters, process memory and event-loop delay.
* `services/translation-engine/deploy/i18n-health.sh` runs every minute: one
  JSON line per run in `/var/log/sv-i18n-health.log`, alerts for failures,
  and after three failed checks a restart of the engine container or a clean
  restart of the application. Alerts are POSTed to `ALERT_WEBHOOK_URL` when
  `/etc/sv-i18n-health.env` sets one.
* `services/translation-engine/deploy/i18n-backup.sh` runs nightly (00:20 UTC):
  a pg_dump of the language tables with row counts and checksums, plus the
  engine's routing, model checksum and image tag, kept 14 days under
  `/root/backups/i18n/`. `i18n-restore-test.sh` restores the latest one into a
  scratch PostgreSQL every Sunday and compares the counts.
* Retention: `public.i18n_prune()` (hourly, from the job worker) deletes jobs
  finished more than seven days ago and quota windows older than two days.
