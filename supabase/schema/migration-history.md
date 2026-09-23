# Migration history: what is in this repository, and what is not

Production records 95 applied migrations in `supabase_migrations.schema_migrations`.
`supabase/migrations/` now holds 177 files: the project's own history, plus 14
migrations recovered from that table because they had been applied through the
Supabase dashboard and never existed as files here. Recovered files carry a
header saying so.

The structure every one of them produced is in `public-schema.sql`, which is
taken from production and is the reference for what the schema actually is.

## Applied in production, deliberately **not** committed

**Ten migrations that carry data.** Their statements insert or update rows
(seed content, demo records, and in four cases real e-mail addresses). Committing
them would put customer and private data in the repository, which is not allowed:

| Version | Recorded name | Contains |
|---|---|---|
| 20260802190935 | 90b74d09-a199-4d0d-b657-7fec742796ee | DDL + inserts, 8 e-mail addresses |
| 20260802201103 | eedeab74-c9d7-4a73-8f1a-0f4e4c12e978 | table + inserts, 10 e-mail addresses |
| 20260802202749 | f851e824-1ac3-4ccc-be56-ee4387e6958a | inserts and updates, 8 e-mail addresses |
| 20260802203528 | effe48bd-6aa4-4e2d-9a92-6c29d8223fcf | table + inserts, 4 e-mail addresses |
| 20260802203644 | 935ee05a-f0ea-46c9-996a-33d44328d2c8 | DDL + inserts |
| 20260806014748 | 5b022db5-9b9f-4640-a5a4-a470bc71c10b | DDL + inserts |
| 20260806025445 | 9bbf5b31-f50e-4f95-966a-8b5754f398a6 | function/trigger + inserts |
| 20260808041650 | b2553eac-3588-4ced-bb63-b417df594711 | table + grants + inserts |
| 20260825000000 | marketplace_education_row_foundation | inserts (catalogue rows) |
| 20260825010000 | marketplace_education_metadata | DDL + inserts (catalogue rows) |

The tables, columns, indexes, policies and functions these created **are**
represented in `public-schema.sql`. Only their row content is left out.

**Thirteen empty entries.** These record a version with no statements —
`stale_remote` (2) and `history_placeholder` (11). There is nothing to commit.

## Recorded in the repository but not in the production history

105 files under `supabase/migrations/` have no row in
`schema_migrations`: they were applied before that table was used, or applied
directly. They are kept because they document how the schema was built.
