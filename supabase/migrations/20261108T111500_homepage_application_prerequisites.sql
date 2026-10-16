-- Scoped prerequisites from the existing 20261104 application migrations.
-- This timestamp intentionally falls after the R&D module and before
-- 20261108T112000_homepage_application_lifecycle.sql, which requires these objects.
-- Existing tables, helper definitions and business rows are preserved.

alter table public.marketplace_affiliate_partners
  add column if not exists application jsonb;

alter table public.influencer_applications
  add column if not exists application jsonb;

do $prerequisites$
begin
  if to_regclass('public.application_documents') is null then
    create table public.application_documents (
      id uuid primary key default gen_random_uuid(),
      application_kind text not null
        check (application_kind in ('reseller','vendor','author','franchise','influencer','affiliate')),
      application_id uuid not null,
      owner_user_id uuid references auth.users(id) on delete set null,
      field text not null,
      original_name text not null,
      mime_type text not null,
      size_bytes bigint not null check (size_bytes > 0),
      sha256 text not null,
      bucket text not null,
      storage_path text not null unique,
      uploaded_at timestamptz not null default now()
    );
    create index application_documents_application_idx
      on public.application_documents (application_kind, application_id);
    alter table public.application_documents enable row level security;
    revoke all on public.application_documents from anon, authenticated;
    grant select, insert, delete on public.application_documents to service_role;
    comment on table public.application_documents is
      'Files an applicant uploaded with an application. The file is in the private application-documents bucket; downloads are short-lived signed links issued to the applicant or to application staff.';
  end if;

  if to_regprocedure('public.strip_application_bank_and_id()') is null then
    execute $definition$
      create function public.strip_application_bank_and_id()
      returns trigger
      language plpgsql
      set search_path to 'public'
      as $function$
      declare
        v_keys text[] := array['accountHolder', 'accountNumber', 'ifsc', 'bankName', 'upi', 'idNumber'];
      begin
        if new.application is not null and new.application ?| v_keys then
          new.application := new.application - v_keys;
        end if;
        return new;
      end;
      $function$;
    $definition$;
  end if;
end;
$prerequisites$;

notify pgrst, 'reload schema';
