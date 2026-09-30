-- AMS recognition: a recognition is marked seen when it is shown, not before.
--
-- 20261107T100000 claimed recognitions (marking them shown) as soon as a page
-- learned of them, then queued them. A refresh or a closed tab while they were
-- still queued left them marked shown and never seen. Now a page reads them
-- without claiming (ams_recognition_peek) and claims each presentation as it
-- begins; one that another tab has already shown is skipped.
--
-- The claim also serialises per person, so two tabs claiming the same moment
-- at the same instant cannot split it between them: the first takes all of it.

begin;

create or replace function public.ams_recognition_peek(p_ledger_ids uuid[])
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  return jsonb_build_object('ok', true, 'recognitions', coalesce((
    select jsonb_agg(public.ams_recognition_payload(l.id) order by l.created_at, l.id)
      from public.ams_award_ledger l
     where l.id = any((coalesce(p_ledger_ids, '{}'::uuid[]))[1:50])
       and l.user_id = v_uid
       and public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
       and not exists (select 1 from public.ams_recognition_presentations p where p.ledger_id = l.id)),
    '[]'::jsonb));
end $$;

create or replace function public.ams_recognition_claim(p_ledger_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_claimed jsonb := '[]'::jsonb;
  r         record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_ledger_ids is null or array_length(p_ledger_ids, 1) is null then
    return jsonb_build_object('ok', true, 'claimed', v_claimed);
  end if;

  -- One claim per person at a time: two tabs racing for the same moment are
  -- served one after the other, and the second finds it already taken.
  perform pg_advisory_xact_lock(hashtextextended('ams-claim:' || v_uid::text, 0));

  for r in
    with wanted as (
      select l.id, l.user_id
        from public.ams_award_ledger l
       where l.id = any(p_ledger_ids[1:50])
         and l.user_id = v_uid
         and public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
    )
    insert into public.ams_recognition_presentations (ledger_id, user_id, client)
    select id, user_id, 'browser' from wanted
    on conflict (ledger_id) do nothing
    returning ledger_id
  loop
    v_claimed := v_claimed || jsonb_build_array(public.ams_recognition_payload(r.ledger_id));
  end loop;

  return jsonb_build_object('ok', true, 'claimed', v_claimed);
end $$;

revoke all on function public.ams_recognition_peek(uuid[]) from public, anon;
grant execute on function public.ams_recognition_peek(uuid[]) to authenticated;
revoke all on function public.ams_recognition_claim(uuid[]) from public, anon;
grant execute on function public.ams_recognition_claim(uuid[]) to authenticated;

commit;
