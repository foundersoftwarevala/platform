# Phase 5 — Developer Wallet

## Scope and compatibility decision

Phase 5 adds a separate ledger for developer balances. The existing
`public.wallets` and `public.wallet_transactions` are already used by the
platform/operator finance features with incompatible columns and semantics.
They were not repurposed, renamed, or modified. To avoid corrupting existing
finance data, this phase uses `public.developer_wallets` and
`public.developer_wallet_transactions`; this is the only schema naming
deviation from the requested design.

The migration adds the `finance_manager` label to `public.app_role`, but does
not assign it to any account. Role assignment remains a separate authorized
database operation. The migration was not applied to either database and no
production deployment or data write was performed.

## Migration objects

Migration: [`20261108T150000_developer_wallets.sql`](../../supabase/migrations/20261108T150000_developer_wallets.sql)

- `tasks.amount_cents`: nullable `bigint`, constrained to a positive value
  when set. Finance must set the approved amount before payment
  ([migration:56](../../supabase/migrations/20261108T150000_developer_wallets.sql#L56)).
- `developer_wallets`: UUID primary key, unique developer ID, nonnegative
  `balance_cents`, INR default currency, and update timestamp
  ([migration:73](../../supabase/migrations/20261108T150000_developer_wallets.sql#L73)).
- `developer_wallet_transactions`: wallet FK, optional canonical task FK,
  `credit`/`debit`/`fine`/`payout` type, positive cents, reference/note,
  creator ID and timestamp
  ([migration:81](../../supabase/migrations/20261108T150000_developer_wallets.sql#L81)).
- Indexes: unique developer ID (created by the unique constraint), task ID,
  descending creation time, and a unique partial index allowing at most one
  task credit per task
  ([migration:93](../../supabase/migrations/20261108T150000_developer_wallets.sql#L93)).
- `developer_wallet_apply_transaction`: insert trigger locks the wallet row,
  computes the signed balance effect, rejects negative results, checks a
  task credit matches the paid task's developer, changes the balance, and
  appends a `wallet.tx` audit row
  ([migration:101](../../supabase/migrations/20261108T150000_developer_wallets.sql#L101)).
- `developer_wallet_transactions_append_only`: rejects updates and deletes
  ([migration:196](../../supabase/migrations/20261108T150000_developer_wallets.sql#L196)).
- `developer_wallet_audit_create`: appends a `wallet.create` audit row when a
  wallet is created
  ([migration:213](../../supabase/migrations/20261108T150000_developer_wallets.sql#L213)).
- Preflight requires the existing `audit_logs` state/hash fields and active
  append-only/hash-chain triggers before creating wallet objects
  ([migration:3](../../supabase/migrations/20261108T150000_developer_wallets.sql#L3)).
- RLS permits developers to read their own wallet/transactions and
  `finance_manager` to read all. `anon` and `authenticated` receive no
  write privileges or write policies. Server-role writes are restricted to
  inserts, with balance changes performed only by the security-definer
  transaction trigger
  ([migration:253](../../supabase/migrations/20261108T150000_developer_wallets.sql#L253)).

## Server functions and authorization

All functions are in
[`functions.ts`](../../src/lib/wallet/functions.ts):

- `createWallet` — line 111; finance-manager only, developer account only.
- `creditForTask` — line 130; finance-manager retry path; reads the amount
  from the canonical paid task instead of trusting a caller-supplied amount.
- `debitFine` — line 163; finance-manager only; requires positive cents and
  a reason.
- `payout` — line 189; finance-manager only; requires positive cents and a
  payout reference.
- `getWallet` — line 215; developer self or finance manager.
- `listTransactions` — line 238; developer self or finance manager.
- `listDeveloperWallets` — line 268; finance-manager only.
- `listDueTaskPayments` — line 292; finance-manager only.
- `setTaskAmount` — line 309; finance-manager only; only for unpaid verified
  tasks, and amount changes are audit logged.

The task payment endpoint is
[`markPaid`](../../src/lib/tasks/functions.ts#L285). It requires the
`finance_manager` role ([line 295](../../src/lib/tasks/functions.ts#L295)),
updates the task, and invokes the wallet-credit helper in the same database
transaction. `creditPaidTask` is in
[`service.server.ts`](../../src/lib/wallet/service.server.ts#L58), with ledger
insertion in the shared transaction. Duplicate task credits are idempotent
only when the existing amount and wallet match; conflicts fail explicitly.
Fine and payout entries use the same append-only ledger path
([service.server.ts:100](../../src/lib/wallet/service.server.ts#L100)).

## UI and route wiring

- Developer wallet screen: [`DMWallet.tsx`](../../src/components/developer-management/screens/DMWallet.tsx#L19).
  It uses authenticated server functions for reads and has loading, empty,
  sign-in, and error states. It has no payout action.
- Developer dashboard module: [`ModulePage.tsx`](../../src/components/dashboard/ModulePage.tsx#L25);
  the wallet data source is enabled in
  [`sources.ts`](../../src/lib/dashboard-records/sources.ts#L120).
- Finance dashboard: [`FinanceDashboard.tsx`](../../src/components/finance-manager/FinanceDashboard.tsx#L72).
  It lists developer balances, supports wallet creation, fine/payout entries,
  transaction review, amount setting, and the overdue task-payment queue.
  The payment reference is required before marking a task paid.
- Route: [`control-panel.finance.tsx`](../../src/routes/control-panel.finance.tsx#L1).
  The parent route strictly gates `/control-panel/finance` to
  `finance_manager` with operator bypass disabled
  ([control-panel.tsx:188](../../src/routes/control-panel.tsx#L188)).
- Sidebar destination is `/control-panel/finance`
  ([control-panel.tsx:323](../../src/routes/control-panel.tsx#L323)); its
  Finance Manager item is shown only when the role query confirms the role
  ([ControlPanelSidebar.tsx:246](../../src/components/super-admin-wireframe/ControlPanelSidebar.tsx#L246)).
  The global route gate recognizes the role
  ([RouteAccessGate.tsx:27](../../src/components/auth/RouteAccessGate.tsx#L27)).
- The former Developer Manager payment button is removed; it directs users
  to the finance-manager-only payment workflow
  ([DMPaymentIncentive.tsx:79](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L79)).

## Atomic credit flow

```text
Finance manager sets positive task amount
  -> amount change + task.amount_set audit record commit together
Finance manager marks verified task paid
  -> finance_manager check
  -> task status update + Phase 3 task audit trigger
  -> create developer wallet if absent
  -> insert one credit ledger entry
  -> DB trigger locks wallet, rejects overdraft/mismatched task, updates balance
  -> wallet.tx audit record joins the existing append-only hash chain
  -> one transaction commits; any failure rolls back task, wallet and audit writes
```

## Verification

- `npm.cmd run build` — PASS; the `/control-panel/finance` route was generated
  in `src/routeTree.gen.ts`.
- `npx.cmd vitest run src/lib/wallet/__tests__/format.test.ts` — PASS,
  3 tests, including large-cent precision and invalid input.
- Scoped ESLint with `prettier/prettier` disabled — PASS, zero errors; one
  existing Fast Refresh warning in `RouteAccessGate.tsx`.
- `npx.cmd tsc --noEmit -p .` — PASS; full check completed with exit code 0
  and no diagnostics.
- `npm.cmd run i18n:check` — FAIL on unrelated dirty worktree/catalogue
  findings, including pre-existing hardcoded strings in other modules and a
  stale `ui-source.generated.json`. The run did not report new wallet UI
  strings. These unrelated files were not edited to force a green check.
- SQL migration application/dry-run — NOT RUN. No database was changed.

## Rollback

Prefer reverting the Phase 5 code commits normally. Do not rewrite published
history. If a database rollback is separately authorized, first stop callers
and make verified backups of both developer-wallet tables, relevant
`audit_logs`, and any task amount values. The migration has not been applied;
these commands are illustrative only and must not be run against data without
that backup and an explicit rollback decision:

```sql
BEGIN;
DROP TABLE IF EXISTS public.developer_wallet_transactions;
DROP TABLE IF EXISTS public.developer_wallets;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_amount_cents_positive;
-- Drop amount_cents only if Phase 5 introduced it and no later feature uses it.
ALTER TABLE public.tasks DROP COLUMN IF EXISTS amount_cents;
COMMIT;
```

No legacy wallet grants were changed, so none need restoration. PostgreSQL
does not remove an enum value in place; retain the unused `finance_manager`
label unless a separate, reviewed enum-rebuild migration is approved. Never
drop or alter the existing `public.wallets` or `public.wallet_transactions`.

## Not done

Promise tracker, fine automation, PC assistant, Ayra, chatbot, and AI API were
not touched. No real payout provider integration, finance-role assignment,
database migration application, or production deployment was performed.
