# Master plan — forensic findings, in dependency order

Every item below comes from the forensic scan of 28 September 2026, or from
something found while fixing one of them. Nothing here is speculation: each
names the measurement that put it on the list.

Rules this plan works under: read first, reuse what exists, fix, add only what
is genuinely missing, remove nothing without approval. The site has visitors on
it, so each change captures a baseline first and is verified live afterwards.

Status: `TODO` / `DOING` / `DONE` / `NEEDS-OWNER`

---

## P0 — production outage

### 0.1 The translation engine burned two CPUs while idle  `DONE`

**Issue.** Telemetry reported `cpu=100.0% health=degraded` continuously, and
the public guard recorded **seven 502 incidents a day** on 27 and 28 September.

**Root cause.** CTranslate2 decodes on OpenMP threads, and OpenMP defaults to
`OMP_WAIT_POLICY=ACTIVE`, where an idle worker busy-waits instead of sleeping.
With `intra_threads=2` that is two threads spinning for the life of the
process. Per-thread accounting found exactly two threads in state `R`,
`wchan=0`, holding 37.1M and 37.0M CPU ticks against the main thread's 211k.

**Implementation.** `ENV OMP_WAIT_POLICY=PASSIVE` in the service Dockerfile,
after the dependency layers so it cannot invalidate the pip cache.

**Verification.** Proven before deploying: a second container from the same
image, the same weights and the same env file, differing only in that variable.

| | idle CPU | languages | backend |
|---|---|---|---|
| live, ACTIVE | **150.63%** | 140 | madlad |
| probe, PASSIVE | **0.20%** | 140 | madlad |

After deploying, CPU tracks real work exactly: `inflight=0` → 0.2%,
`inflight=1` → ~155%. 60/60 service tests pass, the homepage is byte-identical,
Hindi holds at 69.0% Devanagari and Arabic at 67.2% with `dir=rtl`, and there
have been **no 502 incidents since**.

**Rollback.** Previous source at `/opt/sv-translate/app.backup-20260928105504`;
the previous image is still tagged.

### 0.2 The reboot pointed the application at the wrong database  `DONE`

**Issue.** Hostinger applied the KVM 4 upgrade by rebooting at 11:30. The site
answered 200 throughout and looked healthy. It was not: `/marketplace` rendered
**1,155,419 bytes instead of 1,256,467**, with the whole Featured Software row
absent, and `sv-telemetry` had been logging `FATAL the application is not
pointed at the VPS gateway` every five minutes since 11:35.

**Root cause.** pm2 resurrected the app from a dump saved on 25 September, and
that dump carried `SUPABASE_URL` pointed at the hosted Supabase project with
the hosted secret. The app was reading a different database entirely.

**Implementation.** The running environment was read from `/proc`, both halves
of the pair corrected together from `/var/www/softwarevala/.env` (a mismatched
pair produced `PGRST301 JWSError` and made it briefly worse), the app restarted
with `--update-env`, and `pm2 save` written so a reboot restores the right one.
The old dump is kept at `/root/.pm2/dump.pm2.backup-20260928123330`.

**Verification.** `/marketplace` back to 1,256,467 bytes with Featured Software
present; telemetry `cpu=39.6% ram=26.1% health=100 healthy`; sweeps, demo-ops
and the payment jobs all reporting ok again.

### 0.3 The data layer did not come back from the reboot  `DONE`

`sv-postgrest` exited 255 and stayed down while the other two containers
returned — PostgREST needs PostgreSQL accepting connections when it starts, and
on a cold boot it is not always there. Nothing watched containers; the guards
watch HTTP.

`scripts/ops/sv-container-guard.sh` runs every five minutes, starts any of the
three required containers that is present and stopped, and reports the app's
backend as well. It only ever starts; it never stops, removes or creates. Its
recovery branch was proven on a disposable container, and its backend check on
all three input shapes.

---

## P0/P1 — public customer flows

### 1.1 `/vala-tv` was a public page behind an operator gate  `DONE`

`RouteAccessGate` gated it to marketing and support. It is the storefront film
listing: the homepage links to it twice, the marketplace twice, the footer once
under "Learn". Every visitor following one of those links was shown "Access
restricted", over HTTP 200, which is why no link check caught it. The gate
protected nothing — the loader calls `sf_vala_tv`, which returns published
videos only, and the homepage already renders that same list anonymously.
Managing the films stays behind `/marketplace-manager`.

Verified anonymously in a browser: `restricted=false`, heading "Vala TV".

### 1.2 The footer sent customers to the operator console  `DONE`

"Contact support" pointed at `/support`, the Support Operations Center, behind
a role gate. There was no customer-facing contact page at all: all eleven
support tickets arrived by email or chat and were typed in by hand.

`/contact` writes through `/api/marketplace/contact` into `support_tickets` —
the table the console already reads. `ams_tickets` is deliberately not the
target: that is the internal work queue and belongs to AMS.

Verified end to end on the live site by `scripts/ops/contact-e2e.mjs`: ticket
`SV-260928-XESMD` created, `channel=web`, tickets 11 → 12, and the page told
the truth about the email — queued, not sent, because no provider exists.

---

## P1 — AI

### 2.1 Every AI feature was refusing every caller  `DONE`

**Root cause.** `auth.getUser(token)` sends whatever key its client was built
with as `apikey`. Six guards built that client with the service-role key,
because they also read `user_roles`, and the auth service answers that with
401 "Invalid API key" — so the token was never looked at and every caller was
turned away, operators included.

    apikey = service-role  ->  401 {"message":"Invalid API key"}
    apikey = publishable   ->  403 bad_jwt   (key accepted, token judged)

That is why AI API Manager showed OpenAI and Anthropic active, approved and
credentialled, both reading "never used"; why `ai_content_usage` held one
request and zero successes; and why only three agents appear in
`ai_agent_runs` — those three are cron workers that never pass a browser guard.

Six guards repaired against one shared check, `lib/auth/bearer-user.server.ts`.
The two places that had already solved this inline keep their working copies.

### 2.2 A dead Anthropic balance took the assistant down  `DONE`

With the guard fixed, real traffic reached a provider for the first time and
Anthropic answered "Your credit balance is too low". `aiStream` used the single
best service and returned its refusal; `aiComplete` had tried every active
service since it was written. Anthropic sorts first by name, so an active,
approved, credentialled OpenAI service sat unused.

`aiStream` now walks the same list under the same rule. **Proven live**:
`POST /api/chat` → HTTP 200, the model replied "CONNECTED", and `usage_events`
records both halves — 12:39:27 http=400 ok=false (Anthropic), 12:39:30 http=200
ok=true (OpenAI).

### 2.3 The assistant recited invented business figures  `DONE`

`/api/chat`'s system prompt carried a block headed "Live business context you
may reference" with a revenue figure, a growth rate, user and franchise counts,
uptime, CPU and RAM readings, an approval count, a ticket count, a CSAT score,
a net profit and a margin. None came from anywhere. Replaced with an
instruction to say it does not have the figure and name the console that does.

### 2.4 A generation had been RUNNING for twenty days  `DONE`

Opened 8 September, never closed, because the process that opened it died and
nothing times out a generation. Closed through the existing lifecycle
(`mm_ai_generation_finish`, status FAILED, `AI_GENERATION_ABANDONED`) with the
product, prompt key, version, hash, context hash and both timestamps intact.
`scripts/ops/ai-generation-recover.mjs` reports before it acts and refuses
anything younger than six hours.

### 2.5 Content generation keeps its own credentials  `TODO`

`src/lib/ai/content-provider.ts` reads provider keys straight from
`process.env` (`OPENAI_API_KEY` and friends) rather than through AI API
Manager. That is a second credential path beside the gateway. Its one recorded
attempt failed with `AI_PROVIDER_NOT_CONFIGURED` while AI API Manager held a
working OpenAI credential the whole time.

---

## P2 — scale

### 3.1 Anonymous HTML micro-caching  `DONE`

Measured before: forty concurrent visitors at 7.4 req/s, median 2.6s, slowest
13.7s, every request rebuilding the same page; a twenty-five request burst put
the translation container at ~150% of a core and PostgreSQL at 27%. Cloudflare
answers `cf-cache-status: DYNAMIC` for HTML and holds none of it.

Sixty seconds of nginx origin cache, on a whitelist of public paths only:

| concurrency | before | after |
|---|---|---|
| 20 | 8.4 req/s, median 1494ms | **28.7 req/s, median 571ms** |
| 40 | 7.4 req/s, median 2580ms | **40.7 req/s, median 653ms** |

Safe because the site sets no cookies at all, the server render is identical
for anonymous and signed-in visitors, and it is always English. None of that is
trusted at run time: an Authorization header or any cookie bypasses the cache
in both directions. Verified: `/checkout`, `/account/*`, `/login`, `/support`,
`/marketplace-manager` and `/api/*` all BYPASS.

### 3.2 PM2 cluster mode  `DONE — measured, and deliberately not enabled`

The brief asked whether cluster mode is beneficial once CPU was measured clean.
It is not the constraint. Under load the Node process peaks at 79–106% of one
core and falls straight back to 0%, while the translation container sits at
120–131% and PostgreSQL at 27%. The bottleneck was repeated rendering, which
3.1 removed.

Cluster would also cost something real: the in-memory rate limiters in
`lead.ts` and `contact.ts` would loosen by the worker count, and
`i18n/metrics.server.ts` keeps its counters in process, so `/metrics` would
report one worker's view. Revisit if Node becomes the ceiling.

### 3.3 Off-server backups  `NEEDS-OWNER`

`sv-db-backup.sh` already dumps with `pg_dump -Fc -Z6`, checks the dump is not
truncated by size and by counting TABLE DATA entries in its TOC, applies
retention, and says plainly `OFF-SERVER COPY NOT CONFIGURED - these dumps live
only on this server`. The hook is already written: `/root/.sv-offsite.env` with
`SV_OFFSITE_REMOTE`, copied with rclone.

`rclone` is now installed. What is missing is a destination and its credentials
— a storage account or another machine — which is the owner's to choose.

---

## P1 — money and mail

### 4.1 Payment lifecycle  `AUDITED`

`scripts/ops/payment-lifecycle-audit.sql`, read-only. What holds:

- **No licence exists on an unpaid order.** Ten paid orders carry ten licences;
  eleven pending carry none.
- **Idempotency is enforced by the database** — twelve unique indexes,
  including `(provider, provider_event_id)` on payment events and
  `(provider, provider_refund_id)` on refunds, so a replayed webhook or refund
  is a no-op rather than a second charge.
- **An unsigned webhook cannot become a payment event**:
  `marketplace_record_payment_event` raises "verified provider signature
  required" rather than inserting.
- The settlement outbox is empty and nothing is stuck.

### 4.2 Reconciliation is pointed at the wrong table  `NEEDS-OWNER`

`reconcile_payment_intents()` expires rows in `payment_intents` — one row,
nothing open. The intents a marketplace checkout writes go to
`marketplace_payment_intents`, which has **five pending, the oldest
twenty-four days**, and no `expires_at` column at all. The cron has run every
five minutes and reported success over them throughout.

Left for the owner because how long a checkout stays valid is a business
policy, and these are financial records.

### 4.3 Nothing carries a sale into accounting  `NEEDS-OWNER`

`finance_invoices` has no order, marketplace or source column, so its 131
invoices and 420 transactions belong to a system that never meets the ten paid
marketplace orders. `finance_ledger_entries` is empty. Connecting them decides
invoice numbering and tax treatment.

### 4.4 Email has no provider  `NEEDS-OWNER`

The mailer is complete and honest: it queues durably to `email_outbox`, retries
with backoff to eight attempts, and never reports a send that did not happen.
**57 messages are waiting.** It needs either `RESEND_API_KEY` or
`SMTP_RELAY_URL` + `SMTP_RELAY_TOKEN`. Gmail cannot be used directly — the
mailer speaks HTTP, not SMTP — so this needs an account the owner opens.

---

## P3 — consistency

### 5.1 Public pages without footer or language chrome  `TODO`

Of ten public pages, eight carry neither: `/academy`, `/apply`,
`/apply/reseller`, `/ai/finder`, `/ai/compare` and others. Only `/`,
`/marketplace` and now `/contact` have the full shell.

### 5.2 The stale `softwarevala-lang-staging` pm2 entry  `NEEDS-OWNER`

Stopped, nine restarts, pointing at `/var/www/sv-phase1-check` — which still
exists, and which `/root/cleanup-check.sh`, `/root/failtest.sh` and
`/root/pg.sh` still reference. It is not obviously obsolete and it is stopped,
so it is harmless where it is. Reported, not touched.

### 5.3 The i18n audit is failing on pre-existing drift  `TODO`

`npx vitest run` is 623/624 with one failure, and it was failing before any of
this work: the SEO centre (263 against a baseline of 248), the top bar manager
(71 against 18), enterprise governance, the catalogue admin and several more
have drifted past their baselines. Only the two new contact files were added to
the baseline; absorbing the rest would hide untranslated text somebody still
has to deal with.

### 5.4 Featured Software and the two registries  `NEEDS-OWNER`

`marketplace_homepage_sections.featured-software` is enabled and published,
while `marketplace_row_config.featured-software` is a draft. `mm_row_is_live`
reads the second, so whether the row appears depends on which registry is
consulted. It is rendering today. Publishing a homepage row is a content
decision.

---

## Measurements, before and after

| | before | after |
|---|---|---|
| CPU (telemetry) | `cpu=100.0% health=80 degraded` | `cpu=39.6% health=100 healthy` |
| translation engine, idle | 150.63% | 0.20% |
| 502 incidents | 7 a day | 0 since 10:55 |
| HTML, 20 concurrent | 8.4 req/s, median 1494ms | 28.7 req/s, median 571ms |
| HTML, 40 concurrent | 7.4 req/s, median 2580ms | 40.7 req/s, median 653ms |
| sequential median | 343ms | 278ms |
| server | 2 cores, 7 GB | 4 cores, 15 GB, 193 GB |
| AI requests reaching a provider | none, ever | HTTP 200, metered |
| stuck AI generations | 1, twenty days | 0 |
