-- Applications, end to end: what the form collects is what is kept, a refusal
-- is recorded with its reason, and a document is a real file.
--
-- Everything here is additive. No column is dropped or renamed, no status an
-- existing row holds stops being valid, and every function the running site
-- already calls keeps its signature and its answers - the one change to one of
-- them (submit_seller_application) only adds keys to what it returns.

-- --------------------------------------------------------------- affiliates
--
-- The affiliate form collects twenty-one fields and the table could keep one:
-- the display name. Everything else the applicant typed was thrown away on the
-- server. The application is kept now, the way resellers, sellers and
-- franchises keep theirs, with the same review columns.
alter table public.marketplace_affiliate_partners
  add column if not exists application jsonb,
  add column if not exists applied_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- A refusal is not a suspension. "rejected" joins the statuses; none is removed.
alter table public.marketplace_affiliate_partners
  drop constraint if exists marketplace_affiliate_partners_status_check;
alter table public.marketplace_affiliate_partners
  add constraint marketplace_affiliate_partners_status_check
  check (status = any (array['pending', 'approved', 'rejected', 'suspended', 'deactivated']));

-- ------------------------------------------------------- vendors and authors
--
-- The status "rejected" was always allowed on marketplace_sellers; nothing
-- could set it and there was nowhere to keep the reason.
alter table public.marketplace_sellers
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- ---------------------------------------------------------------- documents
--
-- Every application form asks for documents - identity, address proof, GST
-- and registration certificates, a resume - and every one of them kept only
-- the file's name: nothing was ever uploaded. A document is now a stored file,
-- recorded here against the application it belongs to.
--
-- franchise_documents is not reused: it holds the licence's own KYC and
-- compliance files, keyed to a franchise that exists, while these belong to an
-- application that may never become one.
--
-- The file itself is in a private storage bucket. This row is how it is found,
-- checked and handed out: nothing in the browser ever holds a permanent link.
create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_kind text not null
    check (application_kind in ('reseller', 'vendor', 'author', 'franchise', 'influencer', 'affiliate')),
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

create index if not exists application_documents_application_idx
  on public.application_documents (application_kind, application_id);

-- Only the server reads and writes these rows; the browser never does. With RLS
-- on and no policy, the anon and authenticated roles see nothing.
alter table public.application_documents enable row level security;
revoke all on public.application_documents from anon, authenticated;
grant select, insert, delete on public.application_documents to service_role;

comment on table public.application_documents is
  'Files an applicant uploaded with an application. The file is in the private application-documents bucket; downloads are short-lived signed links issued to the applicant or to application staff.';

-- ------------------------------------------ a vendor who then applies as an author
--
-- One account holds one seller record (marketplace_sellers.owner_user_id is
-- unique), and a seller is either a vendor or an author. So someone who has
-- applied as a vendor and then opens the author form cannot hold a second
-- record - but they were told "you have already applied" and handed their
-- vendor number as if it were an author application. The answer now says
-- which application it actually is. The keys the running site reads are
-- unchanged; `conflict` and `existing_kind` are added.
create or replace function public.submit_seller_application(p_kind text, p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_row public.marketplace_sellers%rowtype;
  v_missing text[];
  v_name text;
  v_number text;
  v_application jsonb;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if v_kind not in ('vendor', 'author') then raise exception 'Unknown seller application type'; end if;
  if coalesce((p_application ->> 'agreementAccepted')::boolean, false) is not true then
    raise exception 'The agreement must be accepted';
  end if;
  select * into v_row from public.marketplace_sellers where owner_user_id = v_user;
  if found then
    return jsonb_build_object(
      'application_number', coalesce(v_row.application ->> 'application_number', v_row.slug),
      'status', v_row.status,
      'duplicate', true,
      'id', v_row.id,
      'existing_kind', v_row.seller_kind,
      'conflict', coalesce(v_row.seller_kind, v_kind) <> v_kind);
  end if;
  v_missing := public.role_application_missing(p_application,
    case v_kind
      when 'vendor' then array['fullName','email','phone','country','companyName','registrationNumber',
                               'gstNumber','businessAddress','contactPerson','categoriesInterested']
      else array['fullName','email','phone','country','experienceYears','experienceSummary','techStack',
                 'languages','github','softwareCategories','productsCount'] end);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;
  v_name := left(coalesce(nullif(btrim(p_application ->> 'companyName'), ''), btrim(p_application ->> 'fullName')), 120);
  v_number := case v_kind when 'vendor' then 'SVV-' else 'SVA-' end
              || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_application := (p_application - 'agreementAccepted')
                   || jsonb_build_object('application_number', v_number, 'agreement_accepted_at', now());
  insert into public.marketplace_sellers (owner_user_id, display_name, slug, status, seller_kind, application, applied_at)
  values (v_user, v_name,
          left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60)
            || '-' || lower(substr(v_number, 5, 6)),
          'pending', v_kind, v_application, now())
  returning * into v_row;
  perform public.mm_audit('seller.application_submitted', 'marketplace_seller', v_row.id::text, null,
                          jsonb_build_object('kind', v_kind, 'application_number', v_number), null);
  perform public.mm_notify('seller.application_submitted', 'Application received',
    format('Your %s application %s is pending review.', v_kind, v_number),
    v_user, null, null, null, 0, 'info');
  return jsonb_build_object('application_number', v_number, 'status', v_row.status, 'duplicate', false,
                            'id', v_row.id, 'existing_kind', v_kind, 'conflict', false);
end;
$function$;

-- ------------------------------------------------------- deciding a seller
--
-- The same rules review_franchise_application and
-- review_influencer_application apply: application staff only, never your own
-- application, a reason for every refusal, and a refusal is final. Approval and
-- suspension are the seller-admin decisions the Vendor Manager already makes;
-- this is the path that can also refuse.
create or replace function public.review_seller_application(p_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before public.marketplace_sellers%rowtype;
  v_after public.marketplace_sellers%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_number text;
begin
  if not public.application_staff() then raise exception 'Manager access required'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then raise exception 'Invalid application status'; end if;
  if p_status in ('rejected', 'suspended') and v_reason is null then
    raise exception 'Record why the application is %', case p_status when 'rejected' then 'rejected' else 'suspended' end;
  end if;
  select * into v_before from public.marketplace_sellers where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_before.owner_user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if v_before.status = 'rejected' then raise exception 'This application is already rejected'; end if;
  if v_before.status = p_status then raise exception 'This application is already %', p_status; end if;
  if p_status = 'rejected' and v_before.status <> 'pending' then
    raise exception 'Only a pending application can be rejected; suspend an approved seller instead';
  end if;

  update public.marketplace_sellers
     set status = p_status,
         rejection_reason = case when p_status in ('rejected', 'suspended') then v_reason else rejection_reason end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
         approved_by = case when p_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
         updated_at = now()
   where id = p_id
   returning * into v_after;

  v_number := coalesce(v_after.application ->> 'application_number', v_after.slug);
  perform public.mm_audit('seller.application_' || p_status, 'marketplace_seller', p_id::text,
                          to_jsonb(v_before), to_jsonb(v_after), v_reason);
  if v_after.owner_user_id is not null then
    perform public.mm_notify('seller.application_' || p_status,
      case p_status when 'approved' then 'Application approved'
                    when 'rejected' then 'Application not approved'
                    else 'Seller account suspended' end,
      format('Your %s application %s is now %s.%s', coalesce(v_after.seller_kind, 'seller'), v_number, p_status,
             case when v_reason is not null and p_status <> 'approved' then ' Reason: ' || v_reason else '' end),
      v_after.owner_user_id, null, null, null, 0,
      case p_status when 'approved' then 'success' else 'warning' end);
  end if;
  return jsonb_build_object('ok', true, 'application', to_jsonb(v_after));
end;
$function$;

revoke all on function public.review_seller_application(uuid, text, text) from public;
grant execute on function public.review_seller_application(uuid, text, text) to authenticated, service_role;

-- --------------------------------------------------- deciding an affiliate
create or replace function public.review_affiliate_application(p_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before public.marketplace_affiliate_partners%rowtype;
  v_after public.marketplace_affiliate_partners%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_number text;
begin
  if not public.application_staff() then raise exception 'Manager access required'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then raise exception 'Invalid application status'; end if;
  if p_status in ('rejected', 'suspended') and v_reason is null then
    raise exception 'Record why the application is %', case p_status when 'rejected' then 'rejected' else 'suspended' end;
  end if;
  select * into v_before from public.marketplace_affiliate_partners where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_before.user_id = auth.uid() then raise exception 'You cannot review your own application'; end if;
  if v_before.status = 'rejected' then raise exception 'This application is already rejected'; end if;
  if v_before.status = p_status then raise exception 'This application is already %', p_status; end if;
  if p_status = 'rejected' and v_before.status <> 'pending' then
    raise exception 'Only a pending application can be rejected; suspend an approved affiliate instead';
  end if;

  update public.marketplace_affiliate_partners
     set status = p_status,
         rejection_reason = case when p_status in ('rejected', 'suspended') then v_reason else rejection_reason end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_id
   returning * into v_after;

  v_number := 'AFF-' || upper(substr(replace(v_after.id::text, '-', ''), 1, 10));
  perform public.mm_audit('affiliate.application_' || p_status, 'marketplace_affiliate_partner', p_id::text,
                          to_jsonb(v_before), to_jsonb(v_after), v_reason);
  if v_after.user_id is not null then
    perform public.mm_notify('affiliate.application_' || p_status,
      case p_status when 'approved' then 'Affiliate application approved'
                    when 'rejected' then 'Affiliate application not approved'
                    else 'Affiliate account suspended' end,
      format('Your affiliate application %s is now %s.%s', v_number, p_status,
             case when v_reason is not null and p_status <> 'approved' then ' Reason: ' || v_reason else '' end),
      v_after.user_id, null, null, null, 0,
      case p_status when 'approved' then 'success' else 'warning' end);
  end if;
  return jsonb_build_object('ok', true, 'application', to_jsonb(v_after));
end;
$function$;

revoke all on function public.review_affiliate_application(uuid, text, text) from public;
grant execute on function public.review_affiliate_application(uuid, text, text) to authenticated, service_role;
