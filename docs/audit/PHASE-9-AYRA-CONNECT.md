# Phase 9 — Ayra read-only platform inspection

## Scope

Ayra now has four server-only inspection tools over the canonical platform
database. Business records are read with `withTaskTransaction`; the only
writes made by this feature are the required append-only inspection audit
records. There is no task, promise, wallet, or payment mutation tool.

## Tools and source data

| Tool | Implementation | Source |
|---|---|---|
| `getPlatformHealth()` | [`tools.server.ts`](../../src/lib/ayra/tools.server.ts#L62) | `public.tasks`, `public.task_promises`; active and unpaid counts plus current overdue-task and broken-promise alerts |
| `getDeveloperStatus(developerId)` | [`tools.server.ts`](../../src/lib/ayra/tools.server.ts#L127) | `public.developer_wallets`, `public.tasks`, `public.developer_wallet_transactions` |
| `getFinancialSummary()` | [`tools.server.ts`](../../src/lib/ayra/tools.server.ts#L180) | `public.tasks.amount_cents/payment_status`, `public.developer_wallet_transactions` |
| `searchTask(query)` | [`tools.server.ts`](../../src/lib/ayra/tools.server.ts#L238) | `public.tasks`; exact ID or title substring, maximum ten results |

The database structures are provided by the existing
[canonical task migration](../../supabase/migrations/20261108T145400_tasks_fresh.sql),
[developer-wallet migration](../../supabase/migrations/20261108T150000_developer_wallets.sql),
and [task-promise migration](../../supabase/migrations/20261108T151000_task_promises.sql);
Phase 9 adds no migration.
Amounts are returned as integer-cent strings. Summary results also expose
unpriced due/paid task counts rather than implying that an incomplete sum is
complete.

## Ollama and chat

- The exact read-only system prompt and Ollama tool-call loop are in
  [`core.server.ts`](../../src/lib/ayra/core.server.ts#L15) and
  [`core.server.ts`](../../src/lib/ayra/core.server.ts#L211).
- Requests use the fixed local `ollama-local` endpoint from
  [`ai-local-services.server.ts`](../../src/lib/ai-local-services.server.ts).
  Set `AYRA_OLLAMA_MODEL` in the server environment to the installed model
  name, and use an Ollama model that supports the OpenAI-compatible tool-call
  format. The name is intentionally required rather than guessed. Requests
  time out after 120 seconds; request failures are surfaced to the UI.
- The model can call only the four allowlisted tools. Arguments are validated,
  tool rounds and per-round tool calls are bounded, and tool results are
  returned to the model as data. If the model does not inspect data, the
  response explicitly declines to give a verified platform answer.
- TanStack server-function entry points are
  [`functions.ts`](../../src/lib/ayra/functions.ts#L4).

## UI and access control

- The existing Ayra page mounts the live feed and chat in
  [`AICEOAyra.tsx`](../../src/components/ai-ceo/sections/AICEOAyra.tsx#L129).
- [`AyraLiveFeedChat.tsx`](../../src/components/ai-ceo/AyraLiveFeedChat.tsx#L15)
  loads live database alerts, renders empty/loading/error states, submits
  read-only questions, shows the local model's waiting state, and displays
  tool names used for an answer.
- The route guard is restricted to `boss` and `admin` with operator-role
  expansion disabled in [`ai-ceo.ayra.tsx`](../../src/routes/ai-ceo.ayra.tsx#L21).
  The server independently verifies the bearer token and checks
  `public.user_roles` for exactly those roles in
  [`core.server.ts`](../../src/lib/ayra/core.server.ts#L97). Existing Ayra
  capability/order server functions use the same `boss`/`admin` boundary in
  [`ayra.functions.ts`](../../src/lib/founder/ayra/ayra.functions.ts#L17).

## Inspection audit

Each chat prompt and each tool invocation writes an `audit_logs` row with
`action = 'ayra.inspection'`, the authenticated `actor_id`, the `ayra`
entity type, and prompt/tool metadata. Tool audit insertion completes before
the corresponding business-data query; if audit insertion fails, the
inspection is refused. The database's existing append-only and hash-chain
triggers protect the resulting audit records. The audited code paths are
[`core.server.ts`](../../src/lib/ayra/core.server.ts#L131) and
[`audit.server.ts`](../../src/lib/ayra/audit.server.ts#L3).

## Verification

- Focused ESLint: **PASS** for the changed implementation, UI, route, and
  message-catalogue files using `--rule 'prettier/prettier: off'`.
- Full `npx.cmd tsc --noEmit -p .`: **PASS** (exit code 0 on the completed
  Phase 9 changes).
- `npm run i18n:check`: **not clean on the current worktree**. It reports the
  stale generated source catalogue and hardcoded-string findings in numerous
  unrelated dirty files; the new Ayra UI strings use the `ceo` message
  catalogue. Unrelated files and generated output were not rewritten.
- No live Ollama request or database inspection was performed in this
  implementation session. Runtime model availability depends on
  `AYRA_OLLAMA_MODEL` and the local Ollama service.

## Rollback

Revert the Phase 9 code/documentation commits with normal revert commits.
There is no Phase 9 schema migration or scheduled job to disable. Do not
rewrite published history. Existing audit rows are append-only and should
remain as history.

## Not done

Ayra cannot create, assign, submit, verify, cancel, or pay tasks; change
promises; apply fines; or modify wallets. No Ayra action-execution path,
deployment, database migration, wallet/promise/PC/chatbot/Assist inner-system
change, or external AI API integration was performed.
