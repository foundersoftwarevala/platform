# AI API Manager credential accounts

The AI API Manager reads and writes its provider, model, service, usage, and
credential-account data through direct PostgreSQL connections to the VPS
`sv_platform` database. Browser callers receive only registry JSON and
credential metadata; `secret_encrypted` is never returned.

## Credential storage and routing

`api_keys` remains the single credential store and already supports multiple
rows for a service or provider. The additive migration
`20261109T001000_ai_api_key_health.sql` adds account health metadata and
`20261109T002000_ai_key_integrity_timestamp.sql` keeps local ciphertext checks
separate from provider health. Neither migration copies credentials into a
second table. New credentials are
AES-256-GCM encrypted using `AI_API_CREDENTIAL_ENCRYPTION_KEY`.
Migration `20261109T003000_ai_api_key_expiry_and_fingerprint.sql` adds the
`expired` health state, an active-expiry lookup index, and a unique fingerprint
index so concurrent account creation cannot store duplicate credentials.
It was applied to VPS `sv_platform` only; no provider-account table was added.

The VPS AI request path uses the most recently created active production key
for the requested service (or provider-wide key), excluding expired keys. A
provider HTTP 401 marks that key invalid and permits up to three bounded
failovers to different active keys. Operators must reactivate an invalid key
explicitly after review. HTTP 429 is recorded as throttled, stores provider
`Retry-After` guidance when supplied, and never switches to another account.
The caller must retry after the provider's limit resets. No API key is sent by
an endpoint reachability check.

The AI API Manager's health panel shows `healthy` only after a real successful
completion, `invalid` after HTTP 401, and `throttled` after HTTP 429. Its manual
endpoint check and the scheduled worker are not credential-validity tests.
The worker verifies the encrypted envelope locally and records that a real
provider response is still required to establish validity.

## Health worker

The worker is `scripts/ops/ai-account-health.mjs`; every 15 minutes it marks
expired active keys and checks up to 250 active non-expired credentials across
environments for local envelope integrity. It does not mark a provider key
healthy or valid, and it does not call provider APIs. The intended root-crontab
entry is in `deploy/production/system/cron-sv-ai-api-account-health`; its
installation was not verified. When installed, it sends output to syslog under
`sv-ai-api-account-health`. The integrity and expiry/index migrations are
applied on the VPS. Account and registry UI queries refresh every 30 seconds.
The application release has not been deployed. Logs must not include secrets.

Rollback SQL is in
`supabase/rollbacks/20261109T001000_ai_api_key_health.sql`,
`supabase/rollbacks/20261109T002000_ai_key_integrity_timestamp.sql`, and
`supabase/rollbacks/20261109T003000_ai_api_key_expiry_and_fingerprint.sql`.
The newest rollback refuses to remove the `expired` health state while any
credential row uses it; no credential rows are deleted.
