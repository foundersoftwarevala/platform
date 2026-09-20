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

## Regenerating

    pg_dump "host=<db-host> port=5432 user=postgres dbname=postgres sslmode=require" \
      --schema-only --schema=public --no-owner > supabase/schema/public-schema.sql

Then remove the `\restrict` / `\unrestrict` lines pg_dump adds (they carry a
random per-dump token and only create noise in the diff), and check that
`grep -cE '^COPY |^INSERT INTO'` returns 0 before committing.

Schemas managed by Supabase itself (`auth`, `storage`, `realtime`, `vault`,
`graphql`, `extensions`) are deliberately not included.
