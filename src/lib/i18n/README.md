# The language system

One registry, one language service, one translation pipeline, one engine
interface. 140 registered languages; runtime capability is verified separately.
Registration does not certify every application screen, AI model or voice model.

**Writing code that shows text? Read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**:
`const { t } = useTranslation(); t("module.key", { count })`, keys in
`messages/<module>.ts`, `serverTranslator()` for e-mails, `npm run i18n:check`.

```
 UI:  t("checkout.pay_now")               use-translation.ts -> useLanguage() in language-catalog.ts
        |                                    1. reviewed dictionary (ui-dictionary.ts)
        |                                    2. strings already received (page memory)
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
        +-- additional owned replicas (TRANSLATE_PROVIDER_URLS; no external AI gateway)
```

## Files

| File | What it is |
|---|---|
| `use-translation.ts` | The API: `useTranslation()` (`t`, formatters), `richText`, `<Msg>`. |
| `messages/` | The keyed catalogue: English source per module; the module is the translation context. |
| `server-translate.server.ts` | `serverTranslator()` and `languageOf()` for e-mails and other server text. |
| `DEVELOPER_GUIDE.md` | How to use all of the above. |
| `registry.ts` | The 140 supported languages and 5 retired ones: codes, scripts, direction, formatting and plural locales, fallback chains, aliases, old catalogue codes. Everything resolves through `resolveLanguage`. |
| `language-service.ts` | The visitor's language: get, set, validate, browser detection, locale cookie, `<html lang dir>`, and the pre-paint boot script. |
| `ui-dictionary.ts` | Reviewed interface text. `en` is the source catalogue; 11 other languages are partly covered. |
| `format.ts` | ICU messages (plural, selectordinal, select, `#`, offset) and Intl number/date/currency formatting per language. |
| `pipeline.ts` | The translation pipeline. Pure; every dependency is injected. |
| `engine/` | The provider interface, the engine that picks a provider, and the two adapters. |
| `glossary.ts`, `quality.ts`, `hash.ts` | Terminology protection, output validation, memory keys. |
| `limits.ts` | Caller tiers (anonymous, user, operator) and their limits. |
| `service.server.ts` | Native PostgreSQL memory/glossary, atomic shared quotas, native sessions, owned engine replicas, and language packs. |
| `database.server.ts`, `quota.server.ts` | A bounded native pool, canonical database validation, transactional cross-worker reservation/refund. |
| `session.server.ts`, `session-contract.ts` | Revocable hashed sessions, secure HttpOnly cookies, and same-origin mutation checks. |
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
- Public packs contain only registered interface catalogue text. Historical
  non-catalogue page rows remain in the database but are not published.
  The same catalogue privacy predicate controls shared-memory reads and writes;
  `persist: false` suppresses writes without disabling permitted cache reads.
- Legacy raw-table public read policies are removed. The existing separately
  authorized operator SEO console retains its operator-only RLS access.

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
- `i18n_sessions` — hashed, one-hour native language sessions. Constrained
  native auth functions access accounts; the app role cannot read account
  records. Verify and apply the native migration in
  `deploy/postgres/20261006220000_i18n_native_sessions.sql`.

The authoritative database is **sv_platform**. On this VPS the unrelated
`VPS_DATABASE_URL` points at a legacy database; `I18N_DATABASE_URL` selects
the existing canonical database without changing other modules. There is no
HTTP database gateway or alternate persistence fallback.

## Environment

| Variable | Meaning |
|---|---|
| `I18N_DATABASE_URL` | Native PostgreSQL URL for `sv_platform`. If omitted, `VPS_DATABASE_URL` must itself select `sv_platform`; another database is refused. |
| `TRANSLATE_PROVIDER_URL` | The platform's engine, e.g. `http://127.0.0.1:5100/v1/translate`. |
| `TRANSLATE_PROVIDER_URLS` | Optional comma-separated owned replicas, attempted in order, each with bounded concurrency and an independent circuit breaker. |
| `TRANSLATE_PROVIDER_TOKEN` | Bearer token for it. |
| `I18N_JOB_WORKER` | `off` stops this instance from working the job queue. |
| `I18N_JOB_MAX_LOAD` | Load average above which background translation pauses (default 120 % of the CPUs; the engine's own work already holds it near the CPU count). |

## Operating

`/language-manager` (admin or boss) shows the engine's state, what memory holds
per language, the review queue, the glossary and the job queue, and can
pre-translate the catalogue into any language.

Native password sign-in uses existing confirmed VPS accounts. MFA/SSO is never
bypassed: this password-only flow refuses those accounts. Platform authentication
outside this module remains unchanged; its sessions are not automatically
inherited by language administration.
Native sign-out revokes the session and resets protected console queries.
The console's sign-in page is reachable without the unrelated platform session;
every data/action endpoint still independently requires a native operator.
Chat translation uses this same native cookie, never a platform JWT.

The page exposes `data-translation-status`, `data-translation-fallback`,
`data-translation-pending` and `data-translation-missing`; the selector also
reports incomplete translation. A source fallback is not a success.

`POST /api/i18n/jobs` with `x-internal-token` runs one batch, for a scheduler.
The application works the queue inside the server process, batch after batch
while there is work, pausing when the host's load average is above 120 % of its
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
Language Manager's "pre-translate" action, or `enqueue_texts` with registered
catalogue strings — fills public interface memory. Arbitrary screen text is
translated without shared persistence; it is not silently published from a
private dashboard. Languages the second local backend (LibreTranslate/Argos) covers
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
   names (`locked`). Built from the database once per minute and
   language, kept in the process, served with `Cache-Control: public,
   max-age=60` and an ETag (304 on repeat). Browser revalidation is once per minute.
2. `POST /api/marketplace/translate` for what the pack did not contain, in
   batches of 36. Product names and brand-only strings are answered in the
   browser and never sent; text already in another script is not source text
   and is never sent back.

Memory and glossary use bounded in-process caches and single-flight reads.
Request and engine quotas are reserved transactionally in native PostgreSQL
before work begins, so every instance obeys the same limits. Refunds are
idempotent and refer to the original quota windows. Private/non-catalogue
visitor text is never sent to the persistent background queue.

Historical measurements below describe the previous HTTP-backed deployment,
not certification of this native release or thousands of concurrent cold
inference requests. New release evidence must be recorded separately:

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
