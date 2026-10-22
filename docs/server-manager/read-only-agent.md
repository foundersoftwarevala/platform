# Server Manager read-only agent foundation

The current code supports owner-authenticated server enrollment and a
service-role-only heartbeat endpoint. Enrollment returns a one-time token;
only its SHA-256 hash is stored by the proposed database schema. Heartbeats
accept a strict metrics/security-signal JSON contract and require an
`Idempotency-Key`. Browser reads use the authenticated customer's RLS-scoped
session.

Server health is based on agent `last_seen`: under 90 seconds is live,
90 seconds through five minutes is stale, over five minutes is offline, and
missing, invalid, or future timestamps are unknown. Metrics are considered
current only when the agent heartbeat and sample timestamp are both fresh.
Monitoring, resource, network, performance, and uptime screens use the
agent-history query; unavailable or incomplete data remains unknown.

The migration
`supabase/migrations/20261108T141000_server_agent_read_only_enrollment.sql`
has not been applied. Do not enable enrollment until the migration is reviewed
and applied to the intended database. A Linux Bash source agent and installer
are now included, but there is no signed/packaged agent release or Windows and
macOS agent. Do not run an unreviewed installer or represent a pending
enrollment as connected. Agent distribution, live database acceptance,
renter-facing authorization review, and production deployment are separate
prerequisites.

`supabase/migrations/20261108T142000_server_ai_insight_acknowledgement_only.sql`
restricts authenticated insight access to read plus status-only acknowledgement
or dismissal. Insight creation remains server-side, and execution-related
fields cannot be written by authenticated clients. This migration is also
unapplied; existing legacy `applied` values are displayed as unverified and
are not rewritten.

The agent contract explicitly rejects passwords and command fields. The
heartbeat endpoint cannot execute customer-server commands. Existing
server-manager pages must continue to avoid SSH, root credentials, remote
execution, backup/restore execution, and firewall changes.

## Linux agent, alerts, lifecycle, and invoices

The Bash runtime in `scripts/server-manager/sv-readonly-agent.sh` reads
`/proc/stat`, `/proc/meminfo`, `/proc/net/dev`, `/proc/uptime`, and `df` output
without root privileges. It posts CPU, memory, root-filesystem use, aggregate
network rates, and uptime every 60 seconds over HTTPS. The service runs as
`sv-server-agent` with no Linux capabilities, a read-only system filesystem,
and no-new-privileges. The separate installer requires administrator consent
only to create the service account, protected token file, and systemd unit.
Failed-login, open-port, and suspicious-process signals are `null`, not
fabricated zeros: this agent does not collect them.

The canonical heartbeat path is `POST /api/agent/heartbeat`; the older
`/api/server-manager/heartbeat` path remains an alias. Both use the same
token-hashing and idempotent database RPC.

Inserts made by the service role into `server_alerts` create email and webhook
delivery records. The internal alert worker queues verified-account email in
the existing `email_outbox`; email actually leaves only when the existing
provider is configured and the email flush runs. Webhook delivery requires
both `SERVER_ALERT_WEBHOOK_URL` (HTTPS) and
`SERVER_ALERT_WEBHOOK_SECRET`; each request is HMAC-SHA256 signed. These
environment values are operator configuration, not tenant-supplied URLs.
Alert and lifecycle emails use a stable outbox idempotency key, and webhook
requests include a stable delivery id for receiver-side deduplication.
Unconfigured channels are recorded as skipped; transient webhook failures are
retried with bounded backoff.

The internal subscription sweep transitions subscriptions to expiring,
suspended, then cancelled and queues 7/3/1-day and lifecycle emails. Invoice
generation accepts an authenticated owner, creates an issued (not paid)
invoice for the current UTC month with integer minor-unit amount, stores a
private PDF, and returns a five-minute signed download URL.

The Server Manager migration proposals are:

- `20261108T141000_server_agent_read_only_enrollment.sql`
- `20261108T142000_server_ai_insight_acknowledgement_only.sql`
- `20261108T143000_server_alert_delivery_outbox.sql`
- `20261108T144000_server_subscription_lifecycle_and_invoices.sql`

They remain unapplied.
Before enabling the functionality, apply and verify the migrations in order,
configure verified mail delivery and (if used) the signed webhook, then
schedule `scripts/ops/sv-server-manager-jobs.sh` from root's cron every five
minutes, invoking it with Bash and setting `SV_PM2_NAME` to the production
application's PM2 process name when it differs from the helper's default.
No production cron entry or database change is made by this repository change.
