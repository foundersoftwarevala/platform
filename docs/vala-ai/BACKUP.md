# Vala AI — backup and restore

## Where the data lives

`VALA_AI_DATA_DIR` holds everything: `vala.db` (SQLite, WAL mode), `workspaces/`,
`evidence/`, `releases/`. In production it **must** be set and lie outside the application
directory (for example `/var/lib/vala-ai`); otherwise every Vala AI request answers 503 with
the reason. The deploy script replaces `.output` in the app directory, so data kept there would
be at risk.

## Nightly database backup

```bash
# /etc/cron.d/vala-ai-backup  (not installed by this change; production setup needs approval)
30 2 * * * softwarevala cd /var/www/softwarevala && VALA_AI_DATA_DIR=/var/lib/vala-ai \
  node scripts/vala-ai/backup.ts --out /var/backups/vala-ai --keep 14 >> /var/log/sv-vala-ai-backup.log 2>&1
```

What it does: `VACUUM INTO` a consistent copy while the server runs, re-opens the copy and
runs `integrity_check` (a failing copy is deleted, not kept), writes `<file>.sha256`, and keeps
the newest 14 copies.

Workspaces, evidence logs and release patches are ordinary files the database points to. Back
them up at file level with the rest of the server (for example `rsync -a /var/lib/vala-ai/
backup-host:…`, excluding `vala.db*` which the job above covers).

## Restore

1. Stop the application (`pm2 stop softwarevala-staging`). Restoring under a running server is
   not supported.
2. `node scripts/vala-ai/backup.ts --restore /var/backups/vala-ai/vala-<time>.db --to /var/lib/vala-ai`
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
- Not done: any backup or restore on the production server.
