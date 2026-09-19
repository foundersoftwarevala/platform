-- Reseller membership events reach the notification bell.
--
-- The canonical inbox is user_notifications, written by mm_notify and read by
-- mm_notifications / mm_notification_read. The membership functions only wrote
-- reseller_notifications (a broadcast list with no recipient user or read
-- state), so nothing a reseller did with a plan ever reached a bell.
--
-- Every membership step is already recorded once in reseller_membership_events
-- (unique event_key). A trigger on that table hands each step to mm_notify:
--   order.created          -> the reseller
--   payment.pending        -> the reseller, and Finance (admin/boss/finance)
--   membership.activated   -> the reseller
--   payment.failed/cancelled/expired/refunded -> the reseller
-- No second notification system; the membership functions are unchanged.
--
-- Also:
--   * user_notifications joins the supabase_realtime publication so a bell
--     can refresh the moment a row arrives (RLS still decides who sees what).
--   * The INSERT policy "Authenticated insert notifications" let any signed-in
--     user write a notification - with any text and link - into anyone's
--     inbox. Inserts are now limited to the caller's own inbox or an operator;
--     mm_notify (security definer) is unaffected.

create or replace function public.reseller_membership_event_notify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid;
  v_reseller text;
  v_order public.reseller_membership_orders%rowtype;
  v_plan text;
  v_invoice text;
  v_amount text;
begin
  select user_id, name into v_user, v_reseller from public.resellers where id = new.reseller_id;
  if new.order_id is not null then
    select * into v_order from public.reseller_membership_orders where id = new.order_id;
    select name into v_plan from public.reseller_membership_plans where id = v_order.plan_id;
    select invoice_no into v_invoice from public.finance_invoices where id = v_order.finance_invoice_id;
    v_amount := 'USD ' || to_char(v_order.amount_usd, 'FM999999990.00');
  end if;

  begin
    if new.event_type = 'order.created' and v_user is not null then
      perform public.mm_notify('reseller.membership.order_created',
        'Membership order created',
        format('%s plan, %s. Invoice %s is ready for payment (order %s).',
               coalesce(v_plan, 'Membership'), v_amount, coalesce(v_invoice, '-'), v_order.order_number),
        v_user, null, '/dashboard/reseller', 'Open Membership & Plans', 0, 'info');

    elsif new.event_type = 'payment.pending' then
      if v_user is not null then
        perform public.mm_notify('reseller.membership.payment_submitted',
          'Payment submitted',
          format('Your payment for order %s is with Finance for verification.', v_order.order_number),
          v_user, null, '/dashboard/reseller', 'Open Membership & Plans', 0, 'info');
      end if;
      perform public.mm_notify('finance.reseller_membership.payment_to_verify',
        'Membership payment to verify',
        format('%s submitted a payment for order %s (%s plan, %s).',
               coalesce(v_reseller, 'A reseller'), v_order.order_number, coalesce(v_plan, '-'), v_amount),
        null, array['finance', 'admin', 'boss'], '/finance-manager?view=memberships', 'Verify', 0, 'warning');

    elsif new.event_type = 'membership.activated' and v_user is not null then
      perform public.mm_notify('reseller.membership.activated',
        'Membership activated',
        format('Your %s membership is active.', coalesce(v_plan, '')),
        v_user, null, '/dashboard/reseller', 'Open Membership & Plans', 0, 'success');

    elsif new.event_type in ('payment.failed', 'payment.cancelled', 'payment.expired', 'payment.refunded')
          and v_user is not null then
      perform public.mm_notify('reseller.membership.' || replace(new.event_type, '.', '_'),
        case new.event_type
          when 'payment.failed' then 'Membership payment failed'
          when 'payment.refunded' then 'Membership payment refunded'
          when 'payment.expired' then 'Membership order expired'
          else 'Membership order cancelled' end,
        format('Order %s is now %s.', v_order.order_number, v_order.status),
        v_user, null, '/dashboard/reseller', 'Open Membership & Plans', 0,
        case when new.event_type = 'payment.failed' then 'danger' else 'warning' end);
    end if;
  exception when others then
    -- A notification must never undo the membership step it reports.
    perform public.mm_audit('notification.failed', 'reseller_membership_event', new.id::text, null,
                            jsonb_build_object('event', new.event_type, 'error', sqlerrm), null);
  end;
  return new;
end;
$function$;

drop trigger if exists reseller_membership_event_notify on public.reseller_membership_events;
create trigger reseller_membership_event_notify
  after insert on public.reseller_membership_events
  for each row execute function public.reseller_membership_event_notify();

-- Realtime delivery for the bell.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'user_notifications') then
    execute 'alter publication supabase_realtime add table public.user_notifications';
  end if;
end $$;

-- Nobody writes into someone else's inbox.
drop policy if exists "Authenticated insert notifications" on public.user_notifications;
drop policy if exists user_notifications_insert_own on public.user_notifications;
create policy user_notifications_insert_own on public.user_notifications
  for insert to authenticated
  with check (user_id = auth.uid() or public.mm_is_operator());
