-- Private reseller account settings and KYC document metadata.
-- Sensitive payout details and document metadata are accessed through
-- owner-checked server functions; authenticated clients cannot query these
-- tables directly.

create table if not exists public.reseller_account_settings (
  reseller_id uuid primary key references public.resellers(id) on delete cascade,
  timezone text not null default 'UTC' check (char_length(timezone) <= 100),
  company_address text not null default '' check (char_length(company_address) <= 2000),
  payout_method text not null default 'bank' check (payout_method in ('bank', 'upi')),
  bank_account_holder text not null default '' check (char_length(bank_account_holder) <= 160),
  bank_name text not null default '' check (char_length(bank_name) <= 160),
  bank_account_number text not null default '' check (char_length(bank_account_number) <= 80),
  bank_ifsc text not null default '' check (bank_ifsc = '' or bank_ifsc ~ '^[A-Za-z]{4}0[A-Za-z0-9]{6}$'),
  upi_vpa text not null default '' check (char_length(upi_vpa) <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size between 1 and 10485760),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists reseller_kyc_documents_owner_created_idx
  on public.reseller_kyc_documents (reseller_id, uploaded_by, created_at desc);

alter table public.reseller_account_settings enable row level security;
alter table public.reseller_kyc_documents enable row level security;

revoke all on public.reseller_account_settings, public.reseller_kyc_documents
  from public, anon, authenticated;
grant all on public.reseller_account_settings, public.reseller_kyc_documents
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reseller-kyc-documents',
  'reseller-kyc-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reseller_kyc_documents_read on storage.objects;
create policy reseller_kyc_documents_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reseller-kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'boss')
    )
  );

drop policy if exists reseller_kyc_documents_upload on storage.objects;
create policy reseller_kyc_documents_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reseller-kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reseller_kyc_documents_delete on storage.objects;
create policy reseller_kyc_documents_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reseller-kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
