# Application intake and review

The seven public forms share [kinds.ts](kinds.ts). Submissions use the
applicant's existing session and the role's own submission RPC. The registry
reads the original role table; it does not copy applications into another queue.

| Role | Application table |
| --- | --- |
| Reseller | `resellers` |
| Vendor / author | `marketplace_sellers`, scoped by `seller_kind` |
| Franchise | `franchise_applications` |
| Influencer | `influencer_applications` |
| Affiliate | `marketplace_affiliate_partners` |
| Employee | `employee_applications` |

`/application-manager` provides role filters, pending counts, documents and
audited decisions. Employee approval is **shortlisting only**: it creates no
employment offer, employee account or internal access grant. Employees are not
included in the Marketplace Manager's live partner programme totals.

The Control Panel's **Pending Applications** card uses exact database counts of
`pending` and `in_review` rows and opens the Application Manager. Open queues
page beyond the REST row limit; historical views retain the existing 1,000-row
per-role limit. Missing tables or unavailable counts are errors, not zeroes.
Existing authenticated notification SSE events invalidate counts and queues;
reconnection catches up, with 15-second polling as a fallback.

## Notifications and email

The additive
[lifecycle migration](../../../supabase/migrations/20261108T112000_homepage_application_lifecycle.sql)
creates employee intake/review RPCs, extends private document registration, and
adds lifecycle triggers to the original application tables. New submissions
notify actual application-staff accounts. Status changes invalidate their live
queues. Initial approval/rejection queues applicant email in `email_outbox` in
the same transaction. Deferred triggers allow reseller rejection reasons to be
read from the completed audit record.

Existing role RPCs retain their account notifications. Employee RPCs notify the
applicant without granting roles. Rejection needs a reason; employee reviewers
cannot decide their own application and terminal decisions are final.

Central decisions attempt only that application's queued email when a provider
is configured. Other entry points enqueue through the same database triggers;
their retry/delivery uses the existing authenticated internal email-flush
operation. Configure a verified provider, sender and authorized scheduling before
claiming automatic external delivery. Never flush unrelated historical mail as
a test. Queued, sent and failed are distinct states; missing provider
configuration is visible in the review UI.

## Deployment prerequisites and rollback

Do not deploy the employee-enabled code before this migration is approved and
verified on the active database and cloud project. Back up schema, affected
tables, the existing `application_staff()` definition and runtime configuration.
Dry-run inside a transaction, verify all dependencies, and verify idempotence
before applying. Application startup never applies migrations.

For a code rollback, restore the prior release without restoring an old database
over newly submitted applications. If lifecycle rollback is needed, remove only
the new `application_lifecycle_notify` triggers and
`rd_request_submitted_notify`, revoke authenticated execution of the two new
employee RPCs, and restore the captured `application_staff()` definition.
**Keep** employee applications, documents, audit records, notifications and
queued emails. Keep the expanded document-kind constraint while employee
documents exist. No rollback may drop these tables or delete business rows.
