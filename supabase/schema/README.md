# Database structure snapshot

`public-schema.sql` is a **structure-only** snapshot of the production `public`
schema: tables, columns, constraints, indexes, functions, triggers, row-level
security policies and grants. It is generated with `pg_dump --schema-only` and
contains **no rows** — no products, no customers, no orders, no secrets.

## Why it exists

`supabase/migrations/` is the change history and remains the way the schema is
changed. But not every object in production came from a migration: a number of
tables and functions were created directly in the Supabase project before or
outside that history, so the migration files alone do not describe the whole
schema. This snapshot closes that gap, so the repository shows the structure as
it actually is.

## Rules

- Never add data to this file. If a future dump includes `COPY` or
  `INSERT INTO`, it was produced incorrectly — regenerate it with
  `--schema-only`.
- It is a reference, not a migration. Do not replay it against production. A
  schema change still goes in a new file under `supabase/migrations/` and is
  applied from there.
- Refresh it after applying migrations, so it keeps matching production.
- Do not rename or edit a migration that may already have been applied. A
  migration filename is its version; changing it can make a previously applied
  change look pending. Resolve duplicate versions before applying them, and
  preserve the original filenames for historical migrations.

## Applying migrations to the VPS

`sv_platform` on the VPS is the production source of truth. Do not use
`supabase db push` for it, and do not infer its migration state from
`supabase_migrations.schema_migrations`: tracking on the databases is
incomplete. Inspect the target schema and the whole migration first, confirm
its dependencies and ordering, and take a verified backup before any
production change.

From a trusted environment with the VPS database URL configured locally, apply
one reviewed migration at a time:

```sh
psql "$VPS_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/<migration-file>.sql
```

Use a transaction only for migrations that permit one; files using operations
such as `CREATE INDEX CONCURRENTLY` must run outside a transaction. If
connecting from a workstation is not supported, use the repository's
SSH-based VPS helper instead:

```sh
node scripts/ops/db.mjs --file supabase/migrations/<migration-file>.sql
```

After each application, verify the objects and constraints against
`sv_platform`. The read-only `node scripts/ops/migration-reconcile.mjs`
compares migration-created objects with the live schema; it is not proof of
application for migrations whose effects it cannot discover. Update or create
migration-history records only from verified live evidence, never by assuming
that every file in the repository has been applied.

## Regenerating

    pg_dump "$VPS_DATABASE_URL" \
      --schema-only --schema=public --no-owner > supabase/schema/public-schema.sql

Then remove the `\restrict` / `\unrestrict` lines pg_dump adds (they carry a
random per-dump token and only create noise in the diff), and check that
`grep -cE '^COPY |^INSERT INTO'` returns 0 before committing.

Schemas managed by Supabase itself (`auth`, `storage`, `realtime`, `vault`,
`graphql`, `extensions`) are deliberately not included.
