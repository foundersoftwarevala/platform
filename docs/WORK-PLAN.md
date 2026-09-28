# Work plan — ordered, with what is already known

Written after reading what exists. Nothing below is a guess about the code;
each item names the evidence that put it on the list.

Rules this plan works under: read first, fix, add what is missing, remove
nothing without approval. The live homepage has visitors on it right now, so
everything touching it is additive and verified live before and after.

Status: `TODO` / `DOING` / `DONE` / `NEEDS-OWNER`

---

## P1 — Money. Broken today, customers affected.

### 1.1 Payments settlement has never run  `DOING`

`sv-payment-jobs.sh` calls three routes every five minutes. None exists. The
log holds **168 calls, all http=404, not one 200**, so the settlement queue has
never been drained by the scheduler.

The logic is not missing — only the wiring. These already exist in the
database, with signatures that match what the cron already sends:

| cron calls | database has | matches |
|---|---|---|
| `/api/internal/payment-jobs` `{"limit":25}` | `process_payment_success_events(p_limit int default 25) → jsonb` | exactly |
| `/api/internal/payment-reconcile` `{}` | `reconcile_payment_intents() → jsonb` | exactly |
| `/api/internal/payment-health` `{}` | nothing | see 1.2 |

So this is three thin internal routes over functions that are already written
and already own the business rules. No payment logic is invented here.

### 1.2 Payment health has nothing behind it  `TODO`

No payment health view, function or thresholds table exists; `payment_controls`
holds only enable/disable flags and country lists. The endpoint will report
measured facts — outbox depth, oldest pending event, events that have exhausted
their attempts, intents left open — and will not invent a pass/fail threshold
beyond what is objectively stuck.

### 1.3 Email has a provider now  `TODO`

`sv-email-flush` reports **57 messages waiting, no provider configured** and
correctly refuses to claim success. The owner has supplied
`hellosoftwarevala@gmail.com`. The credential goes through AI API Manager like
every other provider credential, never into a module or a script.

---

## P2 — Marketplace Manager must actually control Marketplace Home

The named goal: point to point, button to button, ultra micro level. Surface as
it stands: **59 manager sections**, and a homepage of ~3,900 lines rendering
roughly 20 sections through `SectionBoundary`.

### 2.0 An anonymous visitor cannot read the database  `NEEDS-OWNER`

Found while tracing why the homepage hero shows the wrong headline, and it is
the root cause under most of P2.

The browser sends the Supabase publishable key as both `apikey` and
`Authorization: Bearer ...`. That key is the new opaque format
(`sb_publishable_...`, 46 characters), which is not a JWT, and the VPS
PostgREST validates JWTs — so it refuses every anonymous request:

    401 PGRST301  JWSError (CompactDecodeError Invalid number of parts:
                  Expected 3 parts; got 1)

The identical query with no Authorization header at all returns 200, because
PostgREST already runs with `PGRST_DB_ANON_ROLE=anon`. So the credential is not
merely useless here — it is the thing causing the refusal.

The visible symptom is the hero. `listHeroSlidesPublic` falls back to
`FALLBACK_HERO_SLIDES` on error, and that file says in its own comment that
seeing those on the site means the query is what to look at. Visitors have been
reading the hardcoded safety-net slide, "12,000+ Software Solutions", instead of
the slides Hero Slides Manager publishes. Every other public client-side read is
refused the same way.

The fix is four lines of nginx on `/rest/v1/` only: pass a credential through
untouched when it is a JWT, and drop it when it is not, so the request arrives
as what it actually is — anonymous. Nothing is weakened. The anon role's grants
and RLS policies still decide what an anonymous visitor may read, and the opaque
key never carried any authority of its own. `/auth/v1/` and `/storage/v1/` are
untouched, so signing in keeps using the publishable key against hosted
Supabase.

**Blocked:** the sandbox refuses changes to auth headers on the live site.
This one needs the owner to allow it or to apply it.

### 2.1 Build the control map  `DOING`

First finding, and a trap worth writing down: the live `/` route renders
`src/components/sapphire-home/HomeIndex.tsx`, **not**
`marketplace-home/HomeIndex.tsx`. The marketplace-home tree is a retired stand
kept beside the live one. Check `src/routes/index.tsx` before editing any
homepage component — I edited the wrong one first.

Sections whose content is hardcoded rather than manager-controlled:
utility-bar, feature-strip, ai-zone, vala-academy, partner-ecosystem,
enterprise-cta, and the search-bar stats badge. The rest read real sources.

Still hardcoded and not yet fixed: the live footer line in sapphire-home
("55 Master Categories ... 20 Live Demos Ready", with the product count taken
from an array length in the browser), and the `/` route title and description
("147 Software Solutions", "20 master categories") — the latter is SEO
metadata, which SEO Manager owns.

One row per homepage section: what renders it, which manager control claims to
own it, which table that control writes, and whether changing the control
actually changes the public render. This is the deep scan, and it is what turns
the rest of P2 from opinion into a list.

Sections to cover, in render order: utility bar, offer banner, feature strip,
featured carousel, Shop by Industry, category slider, search, catalog rows,
category rows, the four curated rows, AI Zone, Success Stories, Awards, Live
Activity, Vala TV, Vala Academy, Partner Ecosystem, footer.

### 2.2 Fix every control that does not reach the render  `TODO`

Each finding gets: connected, or reported NOT CONNECTED with the reason. A
control with no backing is wired, never removed. A section with no control gets
one added.

### 2.3 Prove it from the outside  `TODO`

For each fixed control: change it in the manager, then read the deployed public
HTML and show the change. Not the source, not the browser — the served page.

---

## P3 — The factory records and heals itself

### 3.1 Agent runs beyond the demo team  `TODO`

`fa_agent_run_open`/`_close` exist and the four demo workers use them. The i18n,
SEO and self-healing workers still record nothing, so `founder_operational_health`
under-reports and `reduce_concurrency` verifies against a partial count.

### 3.2 Queue the remaining scheduled work  `TODO`

`sv-seo-crawl` and the i18n workers run as loops rather than off `fa_jobs`.
Moving them onto the queue is what makes the factory uniform: one place that
says what is running, what is stuck and what is retrying.

---

## Unbounded selects — the classification

`node scripts/ops/unbounded-selects.mjs` reports 145 selects with no limit
across 91 tables, 74 of which carry no filter either. Cross-referenced against
live row counts, only three of those tables hold more than 500 rows, and all
three are bounded by a filter rather than a limit:

| table | rows | why it is safe |
|---|---|---|
| `marketplace_translations` | 176,134 | read by `.in(hashes)` — one page's own strings |
| `marketplace_products` | 7,365 | admin table and demo picker are paged; the category read is capped by the category, and the largest holds 161 |
| `server_metrics_history` | 5,318 | read through a six-hour window |

`seo_pages` was on this list and is no longer: its coverage and averages are
computed in SQL now.

The other 88 tables hold 500 rows or fewer. The 74 filterless reads among them
are the shape that will fail silently once a table passes 10,000 — a count or
a list that is quietly the first ten thousand — so they stay on this list as a
standing worklist, ordered by which tables actually grow with use:
`chat_conversations`, `assist_sessions`, `promises`, `server_incidents`,
`user_trophies`. The registry and settings tables beside them do not grow and
need nothing.

They are deliberately not being rewritten as a batch. Changing 74 working
queries at once, on tables of a few hundred rows, risks more than it fixes.

## Done in this run

- Demo Operations fully on the queue: intake, scanner, health, sync, all
  cron-driven, each recording an agent run.
- `ai_agent_runs` written for the first time; `reduce_concurrency` no longer
  verifies against an empty table.
- Three workers were reading only the first 10,000 rows of an unlimited select;
  now paged with keyset on id. Proven on a 17,029-row table.
- `sv-sweeps` and `sv-telemetry` moved off the `.env` file that drifted, onto
  the running process, via one shared reader that refuses a non-VPS target.
- Eight operations scripts that existed only on the server are in git.
