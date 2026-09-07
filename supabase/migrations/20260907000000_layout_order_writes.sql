-- Layout Order writes: loud, atomic, and recorded.
--
-- Three problems with the existing write path, all in the same place.
--
-- A blocked write reported success. Writing to marketplace_homepage_sections
-- requires has_role(auth.uid(), 'admin'), and PostgREST answers a write that
-- RLS filters out with "zero rows updated", not an error. setSectionEnabled
-- returned { ok: true } either way, so a manager without the admin role would
-- toggle a section, see the toggle move, and watch the page ignore it — with
-- nothing anywhere saying why.
--
-- A reorder could be left half applied. It ran as a loop of single-row updates,
-- so a failure on the fourth of eighteen committed the first three and left the
-- page in an order nobody chose.
--
-- And neither write was recorded, though mm_audit exists and every other
-- manager action uses it. Changing what the front page shows is exactly the
-- kind of thing that should be answerable later.
--
-- Both functions are SECURITY INVOKER on purpose. Authorisation stays with the
-- table's own policies rather than moving into the function; the explicit check
-- below only turns a silent no-op into a stated refusal.

create or replace function public.mm_section_set_enabled(
  p_key     text,
  p_enabled boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted to change the homepage layout'
      using errcode = '42501';
  end if;

  select to_jsonb(s) into v_before
    from public.marketplace_homepage_sections s
   where s.key = p_key;

  if v_before is null then
    raise exception 'Unknown homepage section: %', p_key
      using errcode = 'P0002';
  end if;

  update public.marketplace_homepage_sections s
     set enabled = p_enabled,
         -- Switching a section on has to mean it appears. live_now folds
         -- status into the answer, so enabling a draft while leaving it a
         -- draft would move the toggle and change nothing on the page.
         status = case
                    when p_enabled and s.status = 'draft' then 'published'
                    else s.status
                  end,
         published_at = case
                          when p_enabled and s.published_at is null then now()
                          else s.published_at
                        end,
         updated_at = now()
   where s.key = p_key
  returning to_jsonb(s) into v_after;

  if v_after is null then
    raise exception 'Homepage section % could not be updated', p_key
      using errcode = '42501';
  end if;

  perform public.mm_audit(
    case when p_enabled then 'section.enable' else 'section.disable' end,
    'homepage_section', p_key, v_before, v_after, null
  );

  return v_after;
end;
$$;

create or replace function public.mm_sections_reorder(p_order jsonb)
returns integer
language plpgsql
as $$
declare
  v_before  jsonb;
  v_after   jsonb;
  v_changed integer;
  v_known   integer;
  v_asked   integer;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted to change the homepage layout'
      using errcode = '42501';
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'array' then
    raise exception 'mm_sections_reorder expects an array of {key, sort_order}'
      using errcode = '22023';
  end if;

  select count(*), count(distinct e->>'key')
    into v_asked, v_known
    from jsonb_array_elements(p_order) e
   where e->>'key' is not null;

  -- A key listed twice would make the update below pick one of the two
  -- positions arbitrarily, so the request is rejected rather than guessed at.
  if v_asked <> v_known then
    raise exception 'Reorder lists the same section more than once'
      using errcode = '22023';
  end if;

  -- Every key in the request must be a section that exists. A typo silently
  -- doing nothing is how an order ends up half applied without anyone noticing.
  select count(*) into v_known
    from jsonb_array_elements(p_order) e
    join public.marketplace_homepage_sections s on s.key = e->>'key';

  if v_known <> v_asked then
    raise exception 'Reorder names % section(s) that do not exist', v_asked - v_known
      using errcode = 'P0002';
  end if;

  select jsonb_agg(jsonb_build_object('key', key, 'sort_order', sort_order)
                   order by sort_order, key)
    into v_before
    from public.marketplace_homepage_sections;

  -- One statement, so the whole order lands or none of it does.
  update public.marketplace_homepage_sections s
     set sort_order = w.sort_order,
         updated_at = now()
    from (
      select e->>'key' as key, (e->>'sort_order')::int as sort_order
        from jsonb_array_elements(p_order) e
       where e->>'key' is not null
    ) w
   where s.key = w.key
     and s.sort_order is distinct from w.sort_order;

  get diagnostics v_changed = row_count;

  -- Reordering to the order it is already in is a legitimate no-op, so zero
  -- rows is not an error here. The authorisation check above is what
  -- distinguishes that from a refused write.
  if v_changed > 0 then
    select jsonb_agg(jsonb_build_object('key', key, 'sort_order', sort_order)
                     order by sort_order, key)
      into v_after
      from public.marketplace_homepage_sections;

    perform public.mm_audit(
      'section.reorder', 'homepage_section', null, v_before, v_after, null
    );
  end if;

  return v_changed;
end;
$$;

revoke all on function public.mm_section_set_enabled(text, boolean) from public;
revoke all on function public.mm_sections_reorder(jsonb) from public;
grant execute on function public.mm_section_set_enabled(text, boolean) to authenticated;
grant execute on function public.mm_sections_reorder(jsonb) to authenticated;
