# End-to-end verification

These run against a deployed site with real sessions. They create their own
temporary accounts, and they stop at the real payment boundary: no payment is
ever simulated and no order is marked paid.

Nothing here contains a credential. Every script reads what it needs from the
environment:

    SUPABASE_URL                  the project URL
    SUPABASE_SERVICE_ROLE_KEY     admin API, only for creating/deleting the temporary accounts
    ANON                          the anon/publishable key, for signing those accounts in

## The reseller lifecycle

    python3 tests/e2e/lifecycle-accounts.py create accounts.json
    ACCOUNTS=accounts.json REPORT=report.json node tests/e2e/reseller-lifecycle-e2e.mjs
    ANON=... python3 tests/e2e/reseller-security-checks.py accounts.json <product-slug>
    python3 tests/e2e/lifecycle-accounts.py delete accounts.json

`reseller-lifecycle-e2e.mjs` (Playwright) covers: apply → manager approval →
reseller dashboard → membership order and invoice → the payment boundary →
pricing standing and server quote → checkout at the server's price →
notifications with read state → logout/login persistence → language and phone
layout → the other role applications and their manager queues.

`reseller-security-checks.py` covers price/tier/entitlement protection,
isolation between two resellers, notification spoofing, staff-only functions
and idempotency.

## Termination is final

    python3 tests/e2e/termination-accounts.py create accounts.json
    python3 tests/e2e/reseller-termination-checks.py accounts.json state.json phase1
    ACCOUNTS=accounts.json STATE=state.json node tests/e2e/reseller-termination-ui.mjs
    python3 tests/e2e/reseller-termination-checks.py accounts.json state.json phase2
    python3 tests/e2e/termination-accounts.py delete accounts.json

Phase 1 applies, approves, terminates and then tries every way back in
(approval function, direct API as admin, editing the frozen record, the
terminated person themselves) before re-applying. The browser step checks the
Reseller Manager offers no Approve on a terminated record and approves the new
application normally. Phase 2 checks the resulting state, both audit trails,
isolation, authorization and pricing protection, then closes the test records
through the normal workflow.

## Clean-up

The account scripts delete the accounts they made and verify the deletion.
Records the tests created in the platform (applications, orders, invoices) are
**closed through the product's own workflow, never deleted**: financial and
audit history is retained.
