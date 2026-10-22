-- Persist client notes, documents and communication history, plus lead tasks,
-- quotes and proposals entered by a reseller.

create table if not exists public.reseller_client_notes (
  client_id uuid primary key references public.crm_customers(id) on delete cascade,
  owner_id uuid not null references public.team_members(id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_client_communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.crm_customers(id) on delete cascade,
  owner_id uuid not null references public.team_members(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  communication_type text not null check (communication_type in ('call', 'email', 'meeting', 'other')),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.crm_customers(id) on delete cascade,
  owner_id uuid not null references public.team_members(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 15728640),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_agent_id uuid not null references public.lead_agents(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_lead_quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_agent_id uuid not null references public.lead_agents(id) on delete cascade,
  product text not null check (char_length(product) between 1 and 300),
  amount numeric(14, 2) not null check (amount between 0 and 1000000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'sent' check (status in ('draft', 'sent', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_lead_proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_agent_id uuid not null references public.lead_agents(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now()
);

create index if not exists reseller_client_communications_client_created_idx
  on public.reseller_client_communications (client_id, created_at desc);
create index if not exists reseller_client_documents_client_created_idx
  on public.reseller_client_documents (client_id, created_at desc);
create index if not exists reseller_lead_tasks_lead_created_idx
  on public.reseller_lead_tasks (lead_id, created_at desc);
create index if not exists reseller_lead_quotes_lead_created_idx
  on public.reseller_lead_quotes (lead_id, created_at desc);
create index if not exists reseller_lead_proposals_lead_created_idx
  on public.reseller_lead_proposals (lead_id, created_at desc);

alter table public.reseller_client_notes enable row level security;
alter table public.reseller_client_communications enable row level security;
alter table public.reseller_client_documents enable row level security;
alter table public.reseller_lead_tasks enable row level security;
alter table public.reseller_lead_quotes enable row level security;
alter table public.reseller_lead_proposals enable row level security;

revoke all on public.reseller_client_notes,
  public.reseller_client_communications,
  public.reseller_client_documents,
  public.reseller_lead_tasks,
  public.reseller_lead_quotes,
  public.reseller_lead_proposals
  from public, anon, authenticated;

grant all on public.reseller_client_notes,
  public.reseller_client_communications,
  public.reseller_client_documents,
  public.reseller_lead_tasks,
  public.reseller_lead_quotes,
  public.reseller_lead_proposals
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reseller-client-documents',
  'reseller-client-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reseller_client_documents_read on storage.objects;
create policy reseller_client_documents_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reseller-client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reseller_client_documents_upload on storage.objects;
create policy reseller_client_documents_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reseller-client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reseller_client_documents_delete on storage.objects;
create policy reseller_client_documents_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reseller-client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
