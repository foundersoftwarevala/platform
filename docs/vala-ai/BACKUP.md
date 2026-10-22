# Vala AI — backup and restore

## Where the data lives

`VALA_AI_DATA_DIR` holds everything: `vala.db` (SQLite, WAL mode), `workspaces/`,
`evidence/`, `releases/`. In production it **must** be set and lie outside the application
directory (for example `/var/lib/vala-ai`); otherwise every Vala AI request answers 503 with
the reason. The deploy script replaces `.output` in the app directory, so data kept there would
be at risk.

The owned-source studio adds SQLite schema 4's `studio_records` table for its
developer/library/client/workspace/version/audit/build collections. Studio
management metadata and encrypted payment configuration live in `settings`.
The existing whole-database backup includes these records without a separate
Supabase database or backup job. Studio versions and audit records are append-only.

Before deploying this integration, take a verified pre-migration database backup
and filesystem snapshot. Code rollback to a schema-3-only build must also restore
that matching pre-deploy database; restoring under a running application is not
supported. Operator browser caches are convenience copies, not a substitute for
database backups. Preserve the encryption key separately in the authorized
secret store; never include it in logs or source control.

## Nightly database backup

```bash
# /etc/cron.d/vala-ai-backup (installed with infrastructure approval, 2026-10-12)
# Server timezone: UTC. Cron failures go to the local root mailbox.
MAILTO=root
30 2 * * * root /usr/local/bin/vala-ai-backup.sh
```

What it does: `VACUUM INTO` a consistent copy while the server runs, re-opens the copy and
runs `integrity_check` (a failing copy is deleted, not kept), writes `<file>.sha256`, and keeps
the newest seven copies. The source is opened read-only: backups do not initialize or migrate
the application database.

The installed wrapper comes from [backup-cron.sh](../../scripts/vala-ai/backup-cron.sh). It loads the staged
`/etc/softwarevala/vala-ai.env` only for the backup process, uses the standalone CLI under
`/usr/local/lib/vala-ai-backup`, and writes to `/var/lib/vala-ai/backups/`. It locks against
concurrent runs and logs to `/var/log/vala-ai/backup.log` (root-owned 0640, directory 0750).
[The logrotate configuration](../../deploy/production/system/logrotate-vala-ai-backup) provides seven daily log rotations.

The live schema-4 database is present in the configured data directory. Before the scoped
production deployment on 2026-10-18, the installed wrapper created
`/var/lib/vala-ai/backups/vala-20261018T162852Z.db`; its SHA-256 and SQLite
`integrity_check` passed, and exactly seven backups were retained. The wrapper still refuses
to create an empty database when the configured source is absent.

A separate root-only file-level snapshot was created at
`/root/sv-seo-backup/vala-ai-predeploy-20261018T162852Z/data-files.tar.gz`; its SHA-256 and
archive validation passed.

The scoped candidate built successfully and passed its port-3011 homepage, native-language,
session and locale smoke checks before deployment. PM2 is online with the process holding
port 3000, the live server bundle matches the candidate build, the public homepage returned
HTTP 200 on three consecutive checks, and the temporary staging copy of `.env` was removed.
The previous build remains at `/var/www/softwarevala/.output.prev-20261018-163428`.

During initial post-deploy browser verification, 13 HTTP 502 responses were logged between
16:35:56 and 16:40:56 UTC for `/api/notifications/stream`, `/`, and
`/rest/v1/product_demo_urls`. A fresh AI CEO page reload and later homepage checks showed no
5xx, but the cause of those earlier responses was not established; continue monitoring those
endpoints rather than treating every integration as verified.

Workspaces, evidence logs and release patches are ordinary files the database points to. Back
them up at file level with the rest of the server (for example `rsync -a /var/lib/vala-ai/
backup-host:…`, excluding `vala.db*` which the job above covers).

## Restore

1. Stop the application (`pm2 stop softwarevala-staging`). Restoring under a running server is
   not supported.
2. `node /usr/local/lib/vala-ai-backup/scripts/vala-ai/backup.ts --restore /var/lib/vala-ai/backups/vala-<time>.db --to /var/lib/vala-ai`
   - refuses a copy without `.sha256`, with a mismatching hash, or failing `integrity_check`;
   - keeps the replaced database as `vala.db.replaced-<time>` (with its `-wal`/`-shm`).
3. Start the application and check Settings & System: schema version, and "Audit chain: intact".
4. If workspaces were restored from an older file backup than the database, tasks may point at
   commits that no longer exist; their diffs will say "Unknown commit".

## Verified

- `npx vitest run src/lib/vala-ai/backup.server.test.ts`: backup, hash, retention, tamper and
  junk refusal, restore into a fresh directory readable by the application with the audit chain
  intact, replaced database kept, production data-directory rule.
- A backup of the live local development database (WAL mode) restored into a disposable
  directory with identical row counts in projects, tasks, task_events, evidence, approvals,
  releases, audit_log and chat_messages.
- VPS isolated fixture: actual installed cron wrapper created a SQLite snapshot and checksum;
  integrity and restored marker verified, source schema remained unchanged, and eight runs
  retained exactly seven databases plus seven checksum files.
- Actual one-shot cron delivered the absent-source failure to `/var/mail/root`; the temporary
  job was removed and the existing root crontab was preserved.
- At the original 2026-10-12 preparation checkpoint, no live Vala database had been
  initialized, backed up or restored. The later predeployment schema-4 backup is recorded
  above. No provider request or business PostgreSQL write was performed during backup.
- Infrastructure rollback and checksums:
  `/root/sv-seo-backup/vala-ai-step4-20261012T162336Z/`; alert proof:
  `/root/sv-seo-backup/vala-ai-backup-alert-20261012T162705Z/`.
