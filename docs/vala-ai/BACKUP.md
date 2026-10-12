# Vala AI — backup and restore

## Where the data lives

`VALA_AI_DATA_DIR` holds everything: `vala.db` (SQLite, WAL mode), `workspaces/`,
`evidence/`, `releases/`. In production it **must** be set and lie outside the application
directory (for example `/var/lib/vala-ai`); otherwise every Vala AI request answers 503 with
the reason. The deploy script replaces `.output` in the app directory, so data kept there would
be at risk.

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

The installed wrapper comes from [backup-cron.sh](../../scripts/vala-ai/backup-cron.sh). It loads
`/etc/softwarevala/vala-ai.env`, also activated in the application after the authorized scoped
deployment, uses the standalone CLI under
`/usr/local/lib/vala-ai-backup`, and writes to `/var/lib/vala-ai/backups/`. It locks against
concurrent runs and logs to `/var/log/vala-ai/backup.log` (root-owned 0640, directory 0750).
[The logrotate configuration](../../deploy/production/system/logrotate-vala-ai-backup) provides seven daily log rotations.

**Live backup verified after the authorized 2026-10-12 deployment.** The application initialized
`/var/lib/vala-ai/vala.db` with schema v3. The actual installed wrapper produced
`/var/lib/vala-ai/backups/vala-20261012T182914Z.db` and its checksum; integrity was `ok`.
It was restored into the disposable pre-deploy evidence directory, with identical row counts
in all fourteen application tables (fifteen tables including SQLite's internal sequence table).
The source was not restored or migrated by the backup. If the source is missing in future,
the wrapper still logs `NOT READY` and exits 69 instead of creating a fake successful backup.

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
- Actual live database snapshot/checksum and disposable restore passed after application
  deployment. The running source was not restored. No real provider request or business
  PostgreSQL write was performed.
- Daily 02:30 UTC schedule and seven-copy retention remain installed; actual wrapper output
  reached the root-owned 0640 log, and `logrotate --debug` passed. Seven-copy pruning was
  exercised against an isolated fixture; production currently has its first real snapshot.
- Fresh deployment build/environment/data backup and rollback:
  `/root/sv-seo-backup/vala-deploy-20261012T182540Z/`.
- Infrastructure rollback and checksums:
  `/root/sv-seo-backup/vala-ai-step4-20261012T162336Z/`; alert proof:
  `/root/sv-seo-backup/vala-ai-backup-alert-20261012T162705Z/`.
