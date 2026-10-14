# Database

Postgres via Lovable Cloud. All tables live in `public`, have `id uuid` primary keys and
`created_at` / `updated_at` timestamps where relevant (`pm_touch_updated_at` trigger keeps
`updated_at` fresh on Pro Manager tables).

## Access model

- Row Level Security is enabled on every table.
- Each table has a single read policy for public access; `INSERT`, `UPDATE` and `DELETE`
  are denied to `anon`/`authenticated`.
- All writes run through server functions using the service-role client, which bypasses
  RLS after Zod validation — the client can never write directly.

## R&D tables

| Table | Purpose |
| --- | --- |
| `rnd_ideas` | Future Lab idea backlog (category, priority, feasibility, votes, status) |
| `rnd_idea_evaluations` | Stored AI scoring runs (`scores` jsonb + analysis) |
| `rnd_prototypes` | Prototype builds: modules, team, integrations, progress |
| `rnd_impact_analyses` | Impact scoring per feature (revenue, effort, risk, demand) |
| `rnd_trends` | Trend scanner results with competitors and opportunity |
| `rnd_market_gaps` | Detected market gaps (potential, difficulty) |
| `rnd_technologies` | Technology radar entries (ring, relevance) |
| `rnd_feedback` | Feedback portal items with sentiment scoring |
| `rnd_decisions` | Decision board proposals and vote tallies |
| `rnd_pipeline_items` | Innovation pipeline stages and progress |
| `rnd_budgets` / `rnd_transactions` | R&D wallet: current budget and ledger |
| `rnd_notifications` | In-app notification feed (read/dismissed flags) |
| `rnd_ai_messages` | Persisted AI assistant chat turns |

## Pro Manager tables

Core operations: `pm_users`, `pm_products`, `pm_licenses`, `pm_tickets`, `pm_issues`,
`pm_assist_sessions`, `pm_promises`, `pm_upgrades`, `pm_renewals`, `pm_usage`,
`pm_satisfaction`, `pm_compliance`.

Communication & AI: `pm_ai_conversations`, `pm_ai_messages`, `pm_communication_logs`.

Governance: `pm_alerts`, `pm_escalations`, `pm_quality_alerts`, `pm_decisions`,
`pm_health_metrics`, `pm_manager_metrics`, `pm_settings`, `pm_reports`, `pm_audit_logs`.

`pm_audit_logs` is append-only: every mutating server function writes an entry with
action, category, actor, target, IP and status.

## Indexing

Indexes exist on every column used for ordering or filtering, including
`created_at` / `updated_at` / `opened_at` / `detected_at` / `generated_at` sort keys,
foreign keys (`conversation_id`, `budget_id`), and filter columns such as
`rnd_ideas.category`, `rnd_ideas.status`, `rnd_notifications.dismissed`,
`pm_tickets.status`, `pm_users.code` and `pm_escalations.status`.

## Seed data

Tables ship with realistic operational seed rows inserted by migration so every screen
renders meaningful state before external systems are connected. No mock data is
generated in application code.
