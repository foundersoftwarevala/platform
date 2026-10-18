-- The author and vendor rules the owner set, written where the platform can
-- act on them rather than only display them.
--
-- His words, in substance:
--
--   "author wale dashboard mein bhi ek rule banavo ki product verify hone ke
--    baad 7 days mein payment hoga. Tab tak ham log verify karenge - na product
--    sahi hai, na koi fake to nahin hai, na copy to nahin hai, na rights."
--
--   "Ham guarantee lenge uske payment ki, hai na. Par ham kisi aur ke bharose
--    par client ko koi nahin bol sakti payment advance kar do - pehle ham
--    verify karenge."
--
-- So the ordering is the same one the customer gets, applied to the supply
-- side: nothing is paid in advance, verification comes first, and once a
-- product is verified the payment is owed within seven days. Software Vala
-- guarantees the payment; it does not pay on somebody else's word.
--
-- And the identity rule, which is separate and equally fixed:
--
--   "jo bhi product upload hoga usko ham hamare se change karenge... product ka
--    naam kuchh bhi ho isse koi fark nahin padta... kahan detail hi product
--    hoga, yah rule add kar de aur usi ki hi marketing hogi."
--
-- Whoever the author is, and whatever the upload was called, the card detail is
-- the product. The card is what is named, described and marketed. An author
-- changing, or a supplier's own product name, changes nothing downstream.

-- ---------------------------------------------------------------------------
-- 1. When a submission was verified, and when its payment is therefore due.
-- ---------------------------------------------------------------------------
alter table public.author_submissions
  add column if not exists verified_at       timestamptz,
  add column if not exists payment_due_at    timestamptz,
  add column if not exists paid_at           timestamptz,
  add column if not exists payment_reference text;

comment on column public.author_submissions.verified_at is
  'When this submission was verified (status reached approved). Set once and never moved by a later status change.';
comment on column public.author_submissions.payment_due_at is
  'verified_at + the window in the payment_after_verification rule. What the author is owed by.';

-- The window is read from the rule rather than written into the trigger, so
-- changing it is an operator decision in the dashboard and not a migration.
create or replace function public.author_payment_window()
returns interval
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select ((r.config ->> 'days')::int) * interval '1 day'
       from public.author_approval_rules r
      where r.key = 'payment_after_verification' and r.enabled
        and (r.config ->> 'days') ~ '^[0-9]+$'),
    interval '7 days');
$$;

create or replace function public.author_submission_verification_clock()
returns trigger language plpgsql as $$
begin
  -- Verification is the moment the status first reaches approved. It is
  -- recorded once: a later suspension or archive does not un-verify work that
  -- was verified, and must not move the date a payment is owed by.
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    if new.verified_at is null then
      new.verified_at := now();
    end if;
    if new.payment_due_at is null then
      new.payment_due_at := new.verified_at + public.author_payment_window();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists author_submissions_verification_clock on public.author_submissions;
create trigger author_submissions_verification_clock
  before insert or update of status on public.author_submissions
  for each row execute function public.author_submission_verification_clock();

create index if not exists author_submissions_payment_due_idx
  on public.author_submissions (payment_due_at)
  where paid_at is null;

-- ---------------------------------------------------------------------------
-- 2. The rules themselves, in the table the dashboard already reads.
-- ---------------------------------------------------------------------------
insert into public.author_approval_rules (key, label, description, enabled, config)
values
(
  'payment_after_verification',
  'Payment is due within 7 days of verification',
  'No advance payment, on either side of the business. A submission is paid only after it has been verified, and once it has been verified the payment is owed within the window below. '
  'Software Vala guarantees the author''s payment; it does not pay on somebody else''s word that a product is what it claims to be. '
  'The window is what the trigger uses, so changing it here changes what the dashboard chases.',
  true,
  '{"days": 7}'::jsonb
),
(
  'verify_before_acceptance',
  'Verify genuine, original, and correctly licensed before accepting',
  'Before a submission is approved a human confirms four things, and each is a separate reason to refuse: the product is genuine and does what it claims; it is not fake or a shell; it is not a copy of somebody else''s work; and the rights to sell it are the author''s to give. '
  'This is the step that earns the payment guarantee - the guarantee is only safe because nothing is accepted on trust.',
  true,
  '{"checks": ["genuine", "not_fake", "not_copied", "rights_held"]}'::jsonb
),
(
  'card_detail_is_the_product',
  'The card detail is the product',
  'Whoever the author is, and whatever the upload was called, the card is the product. Software Vala sets the name and the detail on the card, and that is what is listed, marketed and sold. '
  'Authors change constantly - a developer today, someone else tomorrow - and an education category takes education products whoever supplied them, so neither the author''s identity nor a supplier''s own product name carries downstream. '
  'The card''s identity is Software Vala''s own and is fixed, which is what lets the catalogue stay stable while its suppliers change.',
  true,
  '{"authoritative": "card", "author_name_carries": false, "supplier_product_name_carries": false}'::jsonb
)
on conflict (key) do update
   set label       = excluded.label,
       description = excluded.description,
       config      = excluded.config,
       updated_at  = now();

-- ---------------------------------------------------------------------------
-- 3. What the dashboard shows: what is owed, and what is late.
-- ---------------------------------------------------------------------------
-- Counted and dated by the database, so the figure cannot drift from a list
-- that happened to be capped at some number of rows.
create or replace function public.author_payments_due()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'window_days', extract(day from public.author_payment_window())::int,
    'awaiting_verification', (
      select count(*) from public.author_submissions
       where status in ('pending_review', 'verifying')),
    'verified_unpaid', (
      select count(*) from public.author_submissions
       where verified_at is not null and paid_at is null),
    'due_within_window', (
      select count(*) from public.author_submissions
       where paid_at is null and payment_due_at is not null
         and payment_due_at >= now()),
    'overdue', (
      select count(*) from public.author_submissions
       where paid_at is null and payment_due_at is not null
         and payment_due_at < now()),
    'oldest_overdue_days', (
      select max(extract(day from now() - payment_due_at))::int
        from public.author_submissions
       where paid_at is null and payment_due_at is not null
         and payment_due_at < now()),
    'paid', (select count(*) from public.author_submissions where paid_at is not null)
  );
$$;

revoke all on function public.author_payments_due() from public;
grant execute on function public.author_payments_due() to authenticated, service_role;

-- Backfill: a submission already approved has been verified, so its clock
-- started when it was decided. Nothing is invented - where there is no decision
-- date the row is left alone rather than given a made-up one.
update public.author_submissions
   set verified_at = decided_at,
       payment_due_at = decided_at + public.author_payment_window()
 where status = 'approved'
   and verified_at is null
   and decided_at is not null;
