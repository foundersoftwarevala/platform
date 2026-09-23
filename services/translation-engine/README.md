# Software Vala translation engine

The platform's own translation service. It runs on the application host, uses
local models only, and is what `TRANSLATE_PROVIDER_URL` points at. No
third-party translation API is involved in normal operation.

Every Software Vala application can use it: it speaks one HTTP contract and
knows nothing about the rest of the platform.

## What it runs on

| Part | Model | Licence | Size |
|---|---|---|---|
| Translation | MADLAD-400 3B MT, CTranslate2 int8 (`Nextcloud-AI/madlad400-3b-mt-ct2-int8`, a conversion of `google/madlad400-3b-mt`) | Apache-2.0 | 2.95 GB |
| Second backend | the self-hosted LibreTranslate container already on the host (Argos Translate models), about 50 languages | AGPL-3.0 (service), model licences per pair | already installed |
| Language identification | fastText `lid.176.ftz`, 176 languages | CC-BY-SA-3.0 | 0.9 MB |

Both model files are pinned by revision and checked against their published
SHA-256 by `deploy/install-models.sh`.

MADLAD covers all 140 languages in the registry. LibreTranslate covers 71 of
them and is used when the model is busy and the request is interactive.

## Endpoints

All `/v1/*` endpoints and `/metrics` need `Authorization: Bearer $SVT_TOKEN`.
The service listens on `127.0.0.1:5100` only.

- `POST /v1/translate` — translate segments. This is the contract the
  application's owned-engine provider speaks:

  ```json
  { "mode": "realtime",
    "source": "en",
    "target": "pt-BR",
    "segments": [{ "id": "0", "text": "Your cart is empty.", "namespace": "ui", "context": null }],
    "glossary": [{ "source": "Checkout", "target": "Finalizar compra" }] }
  ```
  ```json
  { "model": "madlad400-3b-mt-ct2-int8",
    "version": "madlad400-3b-mt-ct2-int8@aa32bbdeba78+routing@2026.09.3",
    "segments": [{ "id": "0", "text": "…", "confidence": 0.85, "backend": "madlad-beam", "flags": [] }] }
  ```
  `source: null` asks the service to detect the language. A segment it cannot
  translate is left out of the answer rather than guessed at.
- `POST /v1/translate/stream` — the same, as server-sent events: one `segment`
  event per segment, then `done`.
- `POST /v1/detect` — `{ "text": "…" }` to language candidates.
- `GET /v1/languages` — the 140 languages with script, direction, backends and
  plural categories.
- `GET /health` (open), `GET /ready` (200 once the model is loaded), `GET /metrics`.

## What happens to a segment

1. Unicode NFC, unified newlines, control characters dropped.
2. Placeholders (`{name}`, `{{count}}`, `%s`, HTML tags, URLs, e-mail
   addresses, and the `⟦T0⟧` tokens the application uses for glossary terms)
   are replaced by `⟦Pn⟧` tokens, as are locked glossary terms.
3. ICU plural, selectordinal and select messages are read apart, each branch is
   translated on its own, and the branches the *target* language needs are
   generated - Russian gets one/few/many/other, Japanese only other. Inside a
   branch, `#` is sent to the model as a real number of that category so the
   words around it take the right form, and put back afterwards.
4. Long text is split into lines and sentences.
5. The batch goes to a backend: the model (beam search for `quality`, greedy
   for `realtime`), or LibreTranslate when the model is busy and the language
   is one it covers. The model is shared this way: visitors' (`realtime`)
   requests queue together and whichever gets the model decodes all of them
   in one batch, whatever their languages (each sequence carries its own
   `<2xx>` target token) - 12 visitors at once, measured, finished in 10.5 s
   and 17 s instead of one after another up to 64 s. Background (`quality`)
   work decodes `SVT_BACKGROUND_BATCH` segments at a time and stands aside
   while any visitor is waiting.
6. Clean-up: a Latin word stuck onto the end of non-Latin text is removed
   when the source never had it (MADLAD appends "Name" to short Hebrew, Hindi
   and Tamil labels). Language-specific fixes: Simplified characters in
   Traditional Chinese converted with OpenCC (`s2t`), Serbian Latin to
   Cyrillic, Uzbek Cyrillic to Latin, ß to ss for Swiss German, the source's
   ellipsis and final stop kept.
7. Tokens are restored. If any went missing, the text is translated again in
   pieces between the placeholders, which cannot lose them.
8. The result is scored: script, repetition, length, whether it is still the
   source text, terminology, and language identification (only to catch the
   two failures it can catch reliably - English left untranslated, or the
   language falling back to its high-resource neighbour). An "English" verdict
   counts only when the answer reuses the source's words, because lid.176 also
   calls short Afrikaans and languages it has no label for (Bambara) English;
   a neighbour verdict counts only when the identifier knows the target
   language. Below 0.5 the
   application stores it for review and shows the fallback instead.
9. The answer is cached in memory, keyed by language pair, mode, text and
   glossary.

## Operating it

```sh
# once, or when a model changes
MODELS=/opt/sv-translate/models ./deploy/install-models.sh

# /etc/sv-translate.env (mode 600)
SVT_TOKEN=<random 32 bytes hex>
SVT_LIBRETRANSLATE_URL=http://libretranslate:5000
SVT_INTRA_THREADS=2

./deploy/deploy.sh                # build, unit tests, restart, wait for /ready
./deploy/deploy.sh --live-tests   # also translates into all 140 languages first
```

The deploy stops if the tests fail, so a bad build never replaces a running
service. `deploy/deploy.sh --live-tests` writes `reports/live-report.json`: one
line per language with the translation, its score, the backend and the time.

Settings (all `SVT_*`, see `sv_translate/config.py`): threads, beam sizes,
batch size, request and segment limits, queue depth, cache size, timeouts.

The container runs read-only, without capabilities, with a memory and CPU
limit, as a non-root user, with the models mounted read-only.

## Health, backup and recovery

On the host (installed by hand once; see the scripts' headers):

| Script | When | What |
|---|---|---|
| `deploy/i18n-health.sh` | every minute | One JSON line in `/var/log/sv-i18n-health.log`: site, language pack and translate endpoint status and latency, engine readiness, queue, database latency, the application's latency percentiles and cache hit ratios. Alerts on failure (and to `ALERT_WEBHOOK_URL` when set in `/etc/sv-i18n-health.env`); after three failed checks restarts the engine container or cleanly restarts the application. |
| `deploy/i18n-backup.sh` | 00:20 UTC | `pg_dump` of the language tables (registry, translation memory, glossary, revisions, jobs) with row counts and checksums, plus `routing.json`, the model checksum, the engine image tag and the nginx real-IP list, under `/root/backups/i18n/<date>/`, kept 14 days. Needs `/etc/sv-i18n-backup.env` (DB_HOST, DB_PASSWORD; mode 600). |
| `deploy/i18n-restore-test.sh` | Sundays 01:00 UTC | Restores the latest backup into a scratch PostgreSQL and compares row counts. |

Restoring after data loss:

1. Schema: apply `supabase/migrations/*i18n*` in order (they are idempotent).
2. Data: `pg_restore --data-only --no-owner --no-privileges --disable-triggers
   -d "<connection>" /root/backups/i18n/<date>/language-data.dump`
   (`--disable-triggers` so the memory guard does not treat the restore as an
   automatic overwrite of reviewed rows).
3. Engine: `deploy/install-models.sh` downloads the pinned model and checks it
   against the recorded checksum; `deploy/deploy.sh` rebuilds and starts the
   container with the saved `routing.json`.
4. Application: redeploy; the language packs and caches fill on first use.

## Tests

```sh
docker run --rm sv-translate:current python -m pytest -q tests --ignore=tests/test_live.py   # no model needed
docker run --rm -e SVT_LIVE=1 -v /opt/sv-translate/models:/models:ro sv-translate:current \
  python -m pytest -q tests/test_live.py                                                    # real models
```

`tests/test_live.py` translates real text with the real models: placeholders,
plural categories per language, glossary terms, detection, the LibreTranslate
fallback, and every one of the 140 languages.

`tests/live_http_check.py` makes the same per-language checks against the
service that is already running, so it needs no second copy of the model in
memory — the way to verify a host after a deploy:

```bash
SVT_TOKEN=$(. /etc/sv-translate.env; echo "$SVT_TOKEN") \
  python3 tests/live_http_check.py reports/live-http.json   # all 140
SVT_ONLY=en,hi,ar python3 tests/live_http_check.py          # a few
```

It checks, per language, that the reply is not the English source, is written in
the script the registry gives, keeps `{name}`, `%s` and HTML tags, comes back
with exactly the plural categories the language has in CLDR, and uses a locked
glossary term. English and its regional variants are the source language, so
only the checks that apply to unchanged text are made for them. It exits
non-zero and names the languages that failed.
