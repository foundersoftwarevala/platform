-- AMS recognition: the presentation window, enforced where it is decided.
--
-- A recognition is news for a day. ams_recognition_pending already looked back
-- only that far, but ams_recognition_peek - which a page calls for any ledger
-- id it is told about - did not, so a notification the sweep repaired days
-- later (the repair looks back seven) could put an old recognition on screen
-- as if it were new. Peek now holds the same one-day window; the notification
-- itself still arrives in the bell.
--
-- Pending listed at most 50 ids, and since listing does not mark anything
-- seen, a person with more than 50 unseen lines (a jump of several stages) was
-- listed the same 50 on every catch-up. It now lists up to 1000.

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
       and l.created_at >= now() - interval '1 day'
       and public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
       and not exists (select 1 from public.ams_recognition_presentations p where p.ledger_id = l.id)),
    '[]'::jsonb));
end $$;

create or replace function public.ams_recognition_pending(p_since timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  return jsonb_build_object('ok', true, 'pending', coalesce((
    select jsonb_agg(l.id order by l.created_at, l.id)
      from (select l2.id, l2.created_at
              from public.ams_award_ledger l2
             where l2.user_id = v_uid
               and l2.created_at >= greatest(coalesce(p_since, now()), now() - interval '1 day')
               and public.ams_recognition_notifiable(l2.asset_kind, l2.reason, l2.xp_awarded)
               and not exists (select 1 from public.ams_recognition_presentations p
                                where p.ledger_id = l2.id)
             order by l2.created_at, l2.id
             limit 1000) l), '[]'::jsonb));
end $$;

commit;
