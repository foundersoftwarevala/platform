-- Batches of two to five hundred addresses, not one file of twelve thousand.
--
-- Twelve thousand is the total the catalogue may eventually hold; it is not how
-- the work arrives. An operator uploads a few hundred, previews them, reviews
-- what could not be placed, commits what is certain, and uploads the next lot.
-- So the unit of work is the batch, and each one has to stand on its own:
-- its own counts, its own errors, its own audit, its own commit. A batch that
-- goes badly must not touch one that went well.
--
-- The rows themselves already live in product_demo_urls and carry their batch id
-- in `processing`. This adds only what a row cannot answer: which file it came
-- from, how many rows were in it, when it was committed, and by whom. Progress
-- is counted from the rows, never stored twice, so it cannot drift from what is
-- actually there.

create table if not exists public.demo_intake_batches (
  id uuid primary key default gen_random_uuid(),
  /** What the operator called the file, so a batch can be recognised later. */
  source_filename text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  status text not null default 'PREVIEW_READY',
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  /** The preview as it stood, so a stale one can be recognised at commit. */
  preview jsonb,
  notes text,
  constraint demo_intake_batches_status_check check (status in (
    'UPLOADED', 'PROCESSING', 'PREVIEW_READY', 'AWAITING_REVIEW',
    'COMMITTED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'))
);

create index if not exists demo_intake_batches_created_idx
  on public.demo_intake_batches(created_at desc);

comment on table public.demo_intake_batches is
  'One upload of demo addresses. Counts are read from product_demo_urls rather than stored here, so batch progress cannot drift from the rows themselves.';

-- ------------------------------------------------------- progress and history
--
-- Every figure is counted from the rows carrying the batch id, so a restart, a
-- retry or a row an operator resolved by hand is reflected the moment it
-- happens. Nothing here is a counter that something else has to remember to
-- increment.
create or replace function public.mm_demo_batches(p_limit integer default 25)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rows_by_batch as (
    select d.processing->'assignment'->>'batch_id' as batch_id,
           d.id,
           d.product_id,
           d.processing->'investigation'->>'state' as investigation_state,
           d.processing->'assignment'->>'state' as assignment_state
      from public.product_demo_urls d
     where d.processing->'assignment'->>'batch_id' is not null
  ),
  counted as (
    select batch_id,
           count(*) as rows_taken,
           count(*) filter (where product_id is not null) as assigned,
           count(*) filter (where product_id is null) as unresolved,
           count(*) filter (where investigation_state is not null) as investigated,
           count(*) filter (where investigation_state is null and product_id is null) as pending,
           count(*) filter (where investigation_state = 'FETCH_FAILED') as fetch_failed,
           count(*) filter (where investigation_state = 'ERROR') as errors,
           count(*) filter (where assignment_state = 'AMBIGUOUS') as ambiguous,
           count(*) filter (where assignment_state = 'UNMATCHED') as unmatched
      from rows_by_batch group by batch_id
  )
  select jsonb_build_object(
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'source_filename', b.source_filename,
               'status', b.status,
               'total_rows', b.total_rows,
               'valid_rows', b.valid_rows,
               'invalid_rows', b.invalid_rows,
               'duplicate_rows', b.duplicate_rows,
               'created_at', b.created_at,
               'created_by_email', b.created_by_email,
               'committed_at', b.committed_at,
               -- Counted from the rows, now, not from anything stored.
               'rows_taken', coalesce(c.rows_taken, 0),
               'assigned', coalesce(c.assigned, 0),
               'unresolved', coalesce(c.unresolved, 0),
               'investigated', coalesce(c.investigated, 0),
               'pending', coalesce(c.pending, 0),
               'fetch_failed', coalesce(c.fetch_failed, 0),
               'errors', coalesce(c.errors, 0),
               'ambiguous', coalesce(c.ambiguous, 0),
               'unmatched', coalesce(c.unmatched, 0))
             order by b.created_at desc)
        from public.demo_intake_batches b
        left join counted c on c.batch_id = b.id::text
       limit greatest(least(coalesce(p_limit, 25), 200), 1)), '[]'::jsonb),
    'generated_at', now()
  );
$$;

revoke all on function public.mm_demo_batches(integer) from public;
grant execute on function public.mm_demo_batches(integer) to authenticated, service_role;

grant select, insert, update on public.demo_intake_batches to service_role;

comment on function public.mm_demo_batches(integer) is
  'Batch history and live progress. Counts come from the rows carrying each batch id, so they cannot drift from what is actually in product_demo_urls.';
