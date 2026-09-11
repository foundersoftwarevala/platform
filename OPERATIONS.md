# Software Vala — payment and platform operations

What to do when something breaks, written for the person on the machine at the
time. Every command, endpoint and table named here is one that exists on this
deployment and was checked against it.

---

## The shape of the system

One Node process, under PM2 in fork mode, behind nginx on a single VPS.

| Thing | Where |
| --- | --- |
| Application | `/var/www/softwarevala`, served from `.output/server/index.mjs` |
| Process | `pm2` — `softwarevala-staging`, listening on `127.0.0.1:3000` (the only application port) |
| Reverse proxy | nginx upstream `softwarevala_app` → `:3000`. `https://softwarevala.net` is the one canonical domain; `http://`, `www.softwarevala.net`, `softwarewala.net` and `www.softwarewala.net` all 301 to it |
| Database | Supabase (PostgREST + Postgres). No direct Postgres client on the box. |
| Secrets | `/var/www/softwarevala/.env`, plus per-rail secrets inside `finance_payment_rails.configuration_state.secrets` |
| Scheduler | root `crontab` and `/etc/cron.d/*`, calling `/usr/local/bin/sv-*` |
| Logs | `pm2 logs`, `/root/.pm2/logs/*`, `/var/log/sv-*.log` |

Two facts that shape every playbook below:

- **There is no PITR on the Supabase project.** The recovery point is the
  nightly logical export in `/var/backups/softwarevala`, taken at 02:30 and kept
  for seven days.
- **There is one process.** In-process state — the provider circuit breakers —
  is cleared by a restart, and a restart drops in-flight requests.

---

## Health, at three depths

| Endpoint | Auth | Question it answers |
| --- | --- | --- |
| `GET /health` | public | Is the process alive? Restart it if not. |
| `GET /ready` | public | Can it serve? Checks the database only. 503 means take it out of rotation, do **not** restart. |
| `GET /api/internal/payment-health` | operator | Are payments actually working? Every number is counted from real rows. |

`/api/internal/payment-health` returns 503 when any signal is critical, so an
uptime check pointed at it reflects whether customers can pay rather than
whether the server is up.

Operator endpoints accept either `x-internal-token: $INTERNAL_API_TOKEN` or a
signed-in operator's `Authorization` bearer token.

```bash
TOKEN=$(grep -E '^INTERNAL_API_TOKEN=' /var/www/softwarevala/.env | cut -d= -f2-)
curl -s -H "x-internal-token: $TOKEN" http://127.0.0.1:3000/api/internal/payment-health | jq
```

Every response carries `x-correlation-id`. That id is the thread: it appears in
the structured stdout logs, in `payment_logs`, and on the outbox event. When a
customer says "I paid and nothing happened", get that id and everything else
follows from it.

---

## PAYMENT PROVIDER OUTAGE

**Detect.** `providers_not_responding` is warning or critical in payment health,
or a provider shows `"circuit": "open"`. In the logs,
`"action":"circuit_transition","to":"open"`.

**Contain.** Nothing to do by hand first — the circuit breaker has already
stopped calling the provider, and `paymentOptions` has already dropped it from
the methods offered at checkout, so customers are being routed to rails that
work. Confirm that at least one other rail is `ready`. If none is, switch off
the dead rail explicitly in Finance Manager so the checkout says so plainly
rather than offering a method that cannot complete.

**Verify.** Check the provider's own status page. Distinguish two cases the
health report already separates: `not responding` (the circuit is open, we
cannot reach them) versus `enabled but unconfigured` (we can reach them, our
credentials are gone — a different incident, see SECURITY INCIDENT).

**Recover.** The breaker recovers on its own. After the cooldown — 60s, doubling
per consecutive failure to a 10-minute cap — it lets exactly one probe through
and closes on success. Do not restart the process to "clear" it; that only
throws away what it has learned. If the provider is fixed and you want the probe
now, a restart is the blunt way, but waiting is almost always right.

**Reconcile.** Customers who were mid-payment when it went down have pending
orders. The consistency sweep asks the provider about each one and settles the
confirmed ones:

```bash
curl -s -X POST -H "x-internal-token: $TOKEN" http://127.0.0.1:3000/api/internal/payment-reconcile | jq
```

**Communicate.** `finance_alerts` has an entry, visible on the Finance Manager
board. Nobody needs to be told a rail is down if another rail worked.

---

## WEBHOOK DELAY OR LOSS

**Detect.** `oldest_pending_payment` climbing past two hours, with
`payment_initiations` normal. Customers reporting a debited card and a pending
order.

**Contain.** Nothing to switch off. A lost callback costs nothing as long as the
sweep runs.

**Verify.** A dropped webhook and a provider outage look alike from the order
table. Check the circuits: if they are closed, we can reach the provider and the
callback is what went missing.

**Recover and reconcile.** Both are the same action, and it is the designed path
rather than a manual repair: run `/api/internal/payment-reconcile`. It asks the
provider directly about each pending reference and settles the ones the provider
confirms, through the same `finance_settle_payment` function a webhook would
have used. It is idempotent, so a late callback arriving afterwards finds the
work already done.

**Never** mark an order paid by hand. The provider's answer is the only thing
that establishes a payment.

---

## PAYMENT STATUS MISMATCH

The order says one thing and the provider says another, or the amount does not
agree.

**Detect.** `amount_mismatches` above zero, or rows in
`finance_reconciliation_records` with `matching_status` other than `matched` and
`resolved_at` null.

**Contain.** Nothing automatic will touch these, by design. The consistency
engine records a mismatch as an exception and never repairs one — a mismatch a
machine quietly corrects is how a real loss becomes invisible.

**Verify.** Pull the correlation id from `payment_logs` for that reference and
read the provider's own record next to ours. Establish which of the two is
wrong before touching anything.

**Recover.** By hand, in Finance Manager's Reconciliation screen, by a person
who has looked at both records. A refund, if one is owed, goes through the
refund path so it lands in the ledger as a matched pair with the original.

**Post-incident.** A mismatch is nearly always a currency or minor-unit bug.
Check `toMinorUnits` against that provider's convention for the currency
involved before assuming it was a one-off.

---

## PAID CUSTOMER WITHOUT THEIR LICENCE

The most urgent one, because the money is right and the customer is still
waiting.

**Detect.** `entitlement_activation_failures` above zero, or `outbox_dead_events`
above zero, or `outbox_backlog` climbing.

**Verify.**

```bash
curl -s -H "x-internal-token: $TOKEN" http://127.0.0.1:3000/api/internal/payment-jobs | jq
```

`pending` climbing means the queue is not being drained — check that cron is
running the sweep. `dead` above zero means events used up their retries and need
a person.

**Recover.** Draining the queue is safe to run at any time and as often as you
like; consumers are idempotent and events are claimed with `FOR UPDATE SKIP
LOCKED`.

```bash
curl -s -X POST -H "x-internal-token: $TOKEN" \
  -d '{"limit":50}' http://127.0.0.1:3000/api/internal/payment-jobs | jq
```

For dead events, find out *why* first — `finance_payment_events.last_error` —
because a dead event usually means the fulfilment itself is broken and replaying
it will simply fail again.

---

## DATABASE FAILURE

**Detect.** `/ready` returns 503. `/health` still returns 200, correctly — the
process is fine.

**Contain.** Do **not** restart the application. It has nothing to do with the
fault and a restart loses in-flight work and the breaker state. Take the server
out of rotation if there is anywhere else to send traffic; on a single VPS there
is not, so the honest action is to let it serve its 503.

**Verify.** Check the Supabase project's own status. Check the credentials in
`.env` are intact — an emptied `SUPABASE_SERVICE_ROLE_KEY` presents exactly as a
database outage.

**Recover.** When `/ready` returns 200 again, the process resumes on its own.

**Reconcile.** Run the consistency sweep afterwards. Payments in flight during
the outage will have failed to settle and are recoverable through the provider.

---

## DATABASE CONNECTION EXHAUSTION

This platform reaches Postgres through PostgREST over HTTPS, so there is no
application-side connection pool to exhaust and no pool to tune. What can be
exhausted is PostgREST's own pool, upstream, which presents as slow or refused
REST calls rather than as anything visible on this box.

**Detect.** `/ready` slow or failing intermittently; REST calls timing out while
the process is otherwise healthy.

**Contain.** Stop the sweeps, which are the heaviest scheduled readers:
`crontab -e` and comment the `sv-sweeps.sh` and `sv-payment-jobs.sh` lines.

**Verify.** In the Supabase dashboard, the project's connection and request
metrics. This is the one failure whose evidence is not on this server.

**Recover.** Restore the cron lines once the upstream recovers.

---

## QUEUE FAILURE

The queue is a table, not a broker, so "the queue is down" means either the
database is unreachable (see DATABASE FAILURE) or the drain is not being called.

**Detect.** `outbox_backlog` climbing steadily with no corresponding failures.

**Verify.** `tail /var/log/sv-payment-jobs.log`. No recent lines means cron is
not calling it. Lines with `FAILED http=401` mean `INTERNAL_API_TOKEN` no longer
matches the running process's environment.

**Recover.** `systemctl status cron`, and confirm
`/usr/local/bin/sv-payment-jobs.sh` is present and executable. Drain by hand in
the meantime with the `payment-jobs` POST above.

---

## DEPLOYMENT FAILURE

**Detect.** `/health` not answering after a deploy, or PM2 showing restarts
climbing.

**Contain.** Roll back immediately; diagnose afterwards. The previous build is
still in git and PM2 keeps running whatever `.output` holds.

```bash
cd /var/www/softwarevala
git log --oneline -5              # find the last good commit
git checkout <good-commit>
npm run build && pm2 restart softwarevala-staging
```

**Verify.** In this order, and all of them:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/health   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/ready    # 200
curl -s -o /dev/null -w '%{http_code}\n' https://softwarevala.net/      # 200
curl -s -H "x-internal-token: $TOKEN" http://127.0.0.1:3000/api/internal/payment-health | jq .overall
```

The homepage is a protected route. It must never be left blank, and a deploy
that blanks it is rolled back before anything is investigated.

---

## STORAGE FAILURE

**Detect.** Uploads failing; payment proofs not rendering.

**Verify.** `df -h` on the VPS first — a full disk presents as almost every
other fault on this list, including PM2 restart loops and failed backups.
Storage buckets themselves are Supabase's, so check the project status next.

**Recover.** If the disk is full, the usual culprits are `/root/.pm2/logs` and
`/var/log/sv-*.log`. The sweep scripts self-trim at 5 MB; PM2's logs do not.
`pm2 flush` is safe.

---

## SECURITY INCIDENT

**Detect.** `webhook_signature_failures` above three in an hour is the signal
that matters most: something is posting callbacks it cannot sign. Also
`providers_enabled_without_credentials` above zero, which can mean a rail's
secrets were altered.

**Contain.** Engage the payments switch in Emergency Controls. `paymentGate`
reads that board on every initiate, so it stops payments everywhere within one
request — no deploy, no restart.

**Verify.** Signature failures alone are often a provider rotating a secret, or
a stale webhook endpoint configured at the provider pointing here. Establish
which before treating it as an attack. Nothing signed incorrectly was ever
acted on — the webhook handler verifies before it settles — so a spike is a
warning, not a breach.

**Recover.** Rotate the affected rail's secret in Finance Manager, and the
webhook secret at the provider, together. Credentials are never in the client
bundle, never in git, and never in logs — the log redactor strips anything
key-shaped before it is written — so the exposure surface is the `.env` file and
the database.

**Reconcile.** Run the consistency sweep. Any payment that arrived while the
gate was shut is recoverable from the provider.

---

## BACKUP AND RESTORE

**Backup.** `/etc/cron.d/sv-db-backup` runs `sv-db-backup.py` nightly at 02:30
into `/var/backups/softwarevala`, keeping seven days. Each run writes a manifest
with a row count and a SHA-256 per table. Verify it is current:

```bash
ls -la /var/backups/softwarevala/
tail -20 /var/log/sv-db-backup.log
```

**Its honest limitation**, stated so it is not discovered during an incident:
this is a per-table export through PostgREST, not a single-transaction snapshot.
Tables are read one after another, so a write landing mid-run can leave two
tables fractionally out of step. For a catalogue that changes slowly it is a
sound restore point. It is not PITR, and PITR is the real fix.

**Restore.** There is no tested automated restore, and this must not be claimed
as verified disaster recovery until one has been performed in an isolated
project. Restoring means creating a separate Supabase project, applying
`supabase/migrations/` in order for the schema, then loading the gzipped
per-table exports through PostgREST in foreign-key order. Never restore over the
live project.

---

## RETENTION

Retention is configured in `data_governance_rules` — `retention_days`, `masking`
and `enabled`, per data class — and edited through the Data Governance panel in
Control Panel.

**Nothing currently enforces those rules.** No job reads that table and deletes
anything, and that is the current honest state rather than an oversight to fix
casually. Financial records, ledger entries, reconciliation records and payment
audit rows must not be deleted on a timer: they are the evidence a dispute is
settled with, and several of them are append-only by design. An enforcement job,
if one is wanted, needs a written per-category decision about what may be
deleted, what may only be anonymised, and what is kept indefinitely — approved
before it is built, not inferred.

The categories, as they stand:

| Category | Tables | Position |
| --- | --- | --- |
| Financial | `finance_payments`, `finance_ledger_entries`, `finance_transactions`, `finance_reconciliation_records` | Keep indefinitely. Ledger entries are immutable. |
| Payment audit | `payment_logs`, `finance_payment_events` | Keep. This is what a chargeback is answered with. |
| Security audit | `error_events`, audit history | Keep. |
| Operational logs | `/var/log/sv-*.log`, PM2 logs | Self-trimmed at 5 MB; PM2's are not trimmed. |
| Backups | `/var/backups/softwarevala` | Seven days, enforced by the backup script. |
| PII | buyer contact details on orders | Anonymise on request; never delete the financial row it hangs off. |

---

## What must never be done

- Marking an order paid by hand. Only the provider's own answer settles a
  payment.
- Retrying a refund because the first one "failed" without checking at the
  provider. A timeout on a refund means *unknown*, and the second one sends the
  money twice. The error message says so.
- Adjusting a wallet or a ledger entry to make a mismatch go away.
- Replaying a dead outbox event without reading `last_error` first.
- Restarting the process to clear a circuit breaker.
- Force-pushing, force-resetting, or deleting files or tables.
