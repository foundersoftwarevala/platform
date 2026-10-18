# Recovery & setup guide

## What lives in this repository
- All app source (`src/`), styles, config, docs.
- Full database structure in `drizzle/migrations/` (0000–0006): every public table, index, trigger, function and RLS policy. Verified against the live database: same 40 tables, same 40 policies.
- Starter sample rows for the R&D workspace / Pro Manager modules (inside 0000/0001 only).

## What is NOT in this repository
- **Live database records** (requests, evaluations, team members, feedback). Export them from Lovable: Cloud → Advanced settings → Export data.
- **Uploaded files** in the private storage bucket `rd-attachments` (request briefs/documents). Recreate the bucket as private when restoring; files must be copied separately.
- **Secrets** (see `.env.example`): `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` (AI features), `RD_MANAGER_PASSWORD` (R&D Manager admin), `RD_SESSION_SECRET` (login cookie signing).

## Restore steps
1. Create a backend project and apply `drizzle/migrations/*.sql` in order.
2. Create private storage bucket `rd-attachments` (10 MB file limit).
3. Set the secrets listed above in the server secret store.
4. Copy `.env.example` to `.env` with the publishable values.
5. `bun install && bun run build`.
6. Import exported database records and storage files if available.

## Backup: database data + uploaded files
Do this regularly (e.g. weekly) and before any big change.

**Database data**
1. In Lovable open Cloud → Advanced settings → Export data and request the export.
2. Make sure these R&D Manager tables are included: `rd_opportunities`, `rd_evaluations`, `rd_projects`, `rd_opportunity_events`, `rd_team_members`, plus `rnd_team_feedback`, `rnd_feedback_insights`, `rnd_notifications`, `rnd_pipeline_items`.
3. Save the downloaded file in a private, encrypted place (it contains submitter names, emails, phones and team password hashes). Never commit it to GitHub.

**Uploaded files (`rd-attachments`)**
1. The bucket is private; files are not included in the data export.
2. Each request's `attachments` column lists file paths (`{path, name, size, type}`). Use it as the file inventory.
3. Download each file via the R&D Manager detail panel (Attachments), or ask the agent to copy all bucket files into a ZIP for you.
4. Store the files next to the data export, keeping the same folder paths.

**Backup checklist**
- [ ] Data export downloaded and opens correctly
- [ ] All R&D tables above present, row counts look right
- [ ] Attachment count matches the paths listed in `attachments`
- [ ] Backup stored privately (not in GitHub, not shared publicly)
- [ ] Backup date written down; old backups kept at least 30 days
- [ ] Secret names noted (values kept only in the secret store)

## Safe test-environment restore
Never test a restore on the live project.
1. Remix/duplicate the project in Lovable (or create a new project from the GitHub repo) and enable a fresh Lovable Cloud backend for it.
2. Confirm the new backend is empty and is NOT the live one.
3. Apply `drizzle/migrations/0000`–`0006` in order (verified: 7 files present).
4. Create private bucket `rd-attachments`, 10 MB limit.
5. Set secrets with TEST values: a different `RD_MANAGER_PASSWORD`, a newly generated `RD_SESSION_SECRET`; `LOVABLE_API_KEY` is provided automatically.
6. `bun install && bun run build` (verified: build script is `vite build`).
7. Import the data export, then upload attachment files to the same paths.
8. Verify: `/start` form submits, `/track` finds a restored Request ID, `/rd-manager` admin login works, a restored request shows its attachments, team members appear in Settings.
9. Prefer anonymised data (fake emails/phones) in test copies; delete the test project when done.

## Notes
- No end-user sign-in is used; no auth providers or redirect URLs need configuring.
- No Edge Functions are used; server logic runs as TanStack server functions.
- `.env` in the repo holds publishable (browser-safe) values only.

## Sample backup (2026-10-13)

A ready-made export is saved in Files under `rnd-backup-2026-10-13/`:

- `manifest.csv` — table name + row count for every R&D table (21 tables)
- One CSV per R&D table (`rd_*` and `rnd_*`) — covers everything the request form, tracking, evaluations, team login, notifications and Feedback Portal read/write
- `rd-attachments.zip` — backup of the private `rd-attachments` bucket. Current file count: 0 (no uploads yet). When uploads exist, add each downloaded file into this ZIP before archiving.

Verified: every CSV parses cleanly and row counts match the live database. To test a real restore, follow "Restore into a test copy" above using these CSVs (import via SQL insert or the run_sql tool), then recreate the `rd-attachments` bucket as PRIVATE.
