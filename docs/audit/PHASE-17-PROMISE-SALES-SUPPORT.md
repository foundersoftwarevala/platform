# Phase 17 — Promise fines and Sales & Support

## Local implementation status

The promise fine tier migration and Sales & Support workspace migrations and
code are present in the repository. The Sales and Support routes use the new
role-checked workspaces; older manager and agent routes no longer expose their
legacy direct-write screens. Sales/Support workspace mutations go through
authenticated server functions. A trusted service-role write from the public
marketplace contact endpoint is attributed as `service_role`; unauthenticated
non-service writes are rejected by the audit trigger.

The Wiki remains available at `/support?section=wiki`. Opening an article is
local UI state and no longer attempts a browser-side view-count write.
Workspace labels are in the i18n catalogue.

## Local verification

| Check | Result |
|---|---|
| `npx.cmd tsc --noEmit -p .` | PASS, exit 0 |
| `npm.cmd run build` | PASS, exit 0 |
| Scoped ESLint with `prettier/prettier` disabled | PASS, exit 0; one existing Fast Refresh warning |
| Focused Sales/Support regression tests | PASS, 27 tests across five files |
| `git diff --check` | PASS when CRLF is recognized with `core.whitespace=cr-at-eol` |
| `i18n:check` | Not a repository-wide pass; existing unrelated findings remain outside the new workspace files |

The SQL assertion script for promise fines has not been run against a database.
No claim is made that the migration has been applied or that the live fine debit
has been exercised.

## Production status

**Deployment: NOT PERFORMED.** SSH to `root@77.37.121.112` was rejected with
`Permission denied (publickey,password)`. Therefore no production migrations,
cron changes, PM2 restart, or live application checks were performed.

The intended production target remains `sv_platform`. The staging database
`softwarevala` was not accessed or changed. Promise cron remains blocked until
an authorized, auditable manager/finance automation actor is provisioned and
`PROMISE_CRON_ACTOR_ID` is configured securely.

Before deployment, obtain working authorized SSH access, verify a fresh
`sv_platform` backup, review and apply only the relevant pending migrations to
`sv_platform`, verify the resulting schema and runtime configuration, then
deploy and smoke-test the application. Do not infer migration success from the
local build or tests.
