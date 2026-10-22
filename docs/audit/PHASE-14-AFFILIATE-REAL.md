# Phase 14 — Affiliate application, tracking and payouts

## Result

The affiliate flow now uses the platform's existing application and partner
records instead of creating parallel affiliate tables. The affiliate dashboard
has its own referral/earnings screen, an owner-scoped summary, and a
transactional payout-request RPC. Affiliate self-referrals are rejected before
an order attribution is written; inability to verify the affiliate owner fails
closed for attribution.

## Application and role flow

1. The home-page Affiliate opportunity card links to `/apply/affiliate`.
   The global Top Utility Bar **Apply Now** action currently targets
   `/apply/reseller`; it was left unchanged because that component already had
   unrelated in-progress edits in the worktree.
2. [`apply.$role.tsx`](../../src/routes/apply.$role.tsx) submits the application
   through `/api/applications/submit`; the authenticated database function
   `submit_affiliate_application` stores it on
   `marketplace_affiliate_partners` as pending. The Affiliate Manager review
   calls `review_affiliate_application`, which writes its existing manager
   audit and notification.
3. The approval-role migration grants `affiliate` only after approval.
   [`dashboard.$role.tsx`](../../src/routes/dashboard.$role.tsx) protects the
   affiliate dashboard with the `affiliate` role requirement.

`affiliate_applications` is an existing manager-facing view, not a new
application table. These paths and approval objects predate this change; no
live application or approval was created during verification.

## Storage and authorization

Migration: [`20261108T155000_affiliate_dashboard_payouts.sql`](../../supabase/migrations/20261108T155000_affiliate_dashboard_payouts.sql).

The migration deliberately reuses:

- `marketplace_affiliate_partners` for applications and affiliate identity;
- `marketplace_referral_codes`, `marketplace_referral_sessions`, and
  `marketplace_order_attributions` for referral tracking;
- `partner_commissions` and `partner_payouts` for the canonical financial
  ledger.

No duplicate `affiliates`, `affiliate_referrals`, or payout ledger was added.
The migration adds affiliate-scoped dashboard indexes, an authenticated
`affiliate_dashboard_summary()` RPC that selects the partner via `auth.uid()`,
and `request_affiliate_payout(numeric,text)`. The payout function locks the
owner's partner row, requires approved status, requires the exact available
approved balance in one currency, creates a `requested` payout, and links the
covered commissions in the same transaction. Completion marks those
commissions paid; failure or cancellation releases them. The platform's
existing no-delete triggers remain in force.

Direct authenticated inserts for affiliate payout rows are excluded from the
partner self-service insert policy; the owner-checked RPC is the affiliate
request path. Existing policies continue to scope commission and payout reads
to the owning partner or a platform operator. The summary RPC also checks the
authenticated user against the partner row and returns only that partner's
records.

**Database application status:** the migration is present in source but was not
applied to either database. SQL policy/function behavior was inspected in the
repository; live RLS behavior, transaction execution, and database
introspection remain unverified.

## Dashboard and server changes

- [`AffiliateWorkspace.tsx`](../../src/components/affiliate/AffiliateWorkspace.tsx)
  is now separate from the reseller referral UI. It shows referral links,
  recorded clicks/visitors/attributed orders, commission ledger rows, earnings
  by currency, payout history, and a request action for available approved
  balances.
- [`account.ts`](../../src/routes/api/affiliate/account.ts) serves the
  authenticated dashboard summary and routes link creation, link toggles, and
  payout requests through server-side APIs. Database read failures are
  surfaced rather than presented as empty totals.
- [`core.server.ts`](../../src/lib/affiliate/core.server.ts) calls the
  caller-authenticated payout and summary RPCs and verifies affiliate ownership
  before attribution.
- [`roles.ts`](../../src/lib/roles.ts) removes unsupported Campaigns, Marketing
  Kit, Rank, AI Tasks, and Reports affiliate promises. Affiliate KPIs now count
  recorded clicks, attributed orders, pending commission entries, and open
  payout requests; amount totals remain grouped by currency in the workspace.
- [`sources.ts`](../../src/lib/dashboard-records/sources.ts) routes affiliate
  metrics to the dedicated screen instead of generic `plain()`/`none()` record
  surfaces.

## Self-referral anti-fraud

[`attribute.ts`](../../src/routes/api/affiliate/attribute.ts) rejects an
affiliate's own order with HTTP 409 before creating an attribution.
[`payment/initiate.ts`](../../src/routes/api/payment/initiate.ts) applies the
same ownership check before writing an attribution; a self-referral is logged
as blocked. If ownership cannot be confirmed, attribution is not written. The
payment itself is not blocked by a referral-service failure. Existing reseller
self-referral review behavior is unchanged.

Automated regression tests cover same-owner rejection, different-owner
acceptance, and failed ownership reads. They do not constitute a live
two-account database test.

## Verified limitations / MISSING

- **Automatic affiliate commission generation is MISSING.** The repository
  contains the shared commission ledger and commission engines for other
  partner kinds, but no affiliate sale-to-commission calculation. The
  application agreement describes a 10–25% range; there is no verified
  per-affiliate rate/rule to calculate a truthful amount. No `awardCommission`
  writer or fabricated commission was added.
- Dashboard earnings and payout requests are real ledger-backed data, but
  affiliates cannot request funds until an authorized process records and
  approves commission rows.
- A payout request is persisted in `partner_payouts` and linked to commissions,
  but a separate append-only actor/IP audit event for that request is
  **MISSING** in the inspected ledger contract.
- The UI displays currently available approved balance; no independent payout
  SLA or minimum threshold is asserted by this implementation.
- The migration was not applied; live manager approval, payout settlement,
  real referral events, and end-to-end database behavior are **NOT VERIFIED**.

## Verification

- `npx.cmd vitest run src/lib/affiliate/core.test.ts src/lib/commerce/payment-initiate.test.ts`
  — PASS, 21 tests across 2 files.
- ESLint on changed affiliate files with
  `--rule 'prettier/prettier: off'` — PASS, zero errors. One existing
  `react-refresh/only-export-components` warning remains in
  `TopUtilityBar.tsx`.
- `npx.cmd tsc --noEmit -p .` — PASS (exit code 0; no diagnostics).
