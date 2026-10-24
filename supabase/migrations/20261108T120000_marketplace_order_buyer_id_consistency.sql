-- `buyer_id` is the canonical owner of a marketplace order. Keep the legacy
-- `user_id` column synchronized for older readers while preventing drift.
begin;

update public.marketplace_orders
set user_id = buyer_id
where user_id is distinct from buyer_id;

alter table public.marketplace_orders
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marketplace_orders'::regclass
      and conname = 'marketplace_orders_user_id_matches_buyer_id'
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_user_id_matches_buyer_id
      check (user_id = buyer_id);
  end if;
end
$$;

create or replace function public.marketplace_orders_sync_user_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.user_id := new.buyer_id;
  return new;
end
$$;

revoke all on function public.marketplace_orders_sync_user_id() from public;

drop trigger if exists marketplace_orders_sync_user_id on public.marketplace_orders;
create trigger marketplace_orders_sync_user_id
before insert or update of buyer_id, user_id on public.marketplace_orders
for each row
execute function public.marketplace_orders_sync_user_id();

commit;
