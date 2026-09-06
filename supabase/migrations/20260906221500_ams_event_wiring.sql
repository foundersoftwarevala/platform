-- Wiring AMS to real platform activity — section 30.
--
-- These triggers are the only things that report activity to AMS, and each one
-- fires on a real state change in a real business table. AMS never invents an
-- occurrence; it observes one.
--
-- Two rules govern every trigger here.
--
-- Attribution must be truthful. An event is credited to the person the row says
-- did the work — the assignee of the task, the seller of the product, the agent
-- on the lead. Where a table records no such person, no event is emitted at
-- all, because guessing would be fabricating.
--
-- And recognition must never break the business. Each trigger swallows its own
-- errors: if AMS is unavailable or a rule is malformed, an order still gets
-- paid and a task still gets completed. Gamification is not allowed to stand in
-- the way of the thing it is measuring.

-- ---------------------------------------------------------------------------
-- Orders — credited to the seller of the product that was bought.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_order_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.status = 'paid' and coalesce(old.status,'') is distinct from 'paid' then
    begin
      -- One event per distinct seller on the order, so a multi-vendor order
      -- credits each of them once rather than crediting the buyer.
      for s in
        select distinct p.seller_id
        from public.order_items oi
        join public.marketplace_products p on p.id = oi.product_id
        where oi.order_id = new.id and p.seller_id is not null
      loop
        perform public.ams_ingest_event(
          s.seller_id, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id));
      end loop;
    exception when others then
      null;  -- Recognition never blocks a payment.
    end;
  end if;
  return new;
end $$;

drop trigger if exists ams_order_paid on public.marketplace_orders;
create trigger ams_order_paid
  after update on public.marketplace_orders
  for each row execute function public.ams_on_order_paid();

-- ---------------------------------------------------------------------------
-- Products — credited to the seller who published.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_product_published()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content_status = 'published'
     and coalesce(old.content_status::text,'') is distinct from 'published'
     and new.seller_id is not null then
    begin
      perform public.ams_ingest_event(
        new.seller_id, 'product.published', 'marketplace_products', new.id::text, 1,
        now(), 'trigger', jsonb_build_object('slug', new.slug));
    exception when others then null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists ams_product_published on public.marketplace_products;
create trigger ams_product_published
  after update on public.marketplace_products
  for each row execute function public.ams_on_product_published();

-- ---------------------------------------------------------------------------
-- Leads — credited to the agent the lead is assigned to.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    -- Captured: only once an agent owns it, because an unassigned lead has not
    -- been earned by anybody.
    if tg_op = 'INSERT' and new.assigned_agent_id is not null then
      perform public.ams_ingest_event(
        new.assigned_agent_id, 'lead.captured', 'leads', new.id::text, 1,
        coalesce(new.created_at, now()), 'trigger', '{}'::jsonb);
    elsif tg_op = 'UPDATE' then
      if new.assigned_agent_id is not null
         and old.assigned_agent_id is distinct from new.assigned_agent_id then
        perform public.ams_ingest_event(
          new.assigned_agent_id, 'lead.captured', 'leads', new.id::text, 1,
          now(), 'trigger', '{}'::jsonb);
      end if;
      if new.status::text = 'won' and coalesce(old.status::text,'') is distinct from 'won'
         and new.assigned_agent_id is not null then
        perform public.ams_ingest_event(
          new.assigned_agent_id, 'lead.converted', 'leads', new.id::text, 1,
          now(), 'trigger', '{}'::jsonb);
      end if;
    end if;
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists ams_lead_activity on public.leads;
create trigger ams_lead_activity
  after insert or update on public.leads
  for each row execute function public.ams_on_lead();

-- ---------------------------------------------------------------------------
-- Outbound contact — credited to whoever logged it.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_lead_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    begin
      perform public.ams_ingest_event(
        new.created_by, 'lead.contacted', 'lead_communications', new.id::text, 1,
        coalesce(new.created_at, now()), 'trigger', '{}'::jsonb);
    exception when others then null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists ams_lead_contact on public.lead_communications;
create trigger ams_lead_contact
  after insert on public.lead_communications
  for each row execute function public.ams_on_lead_contact();

-- ---------------------------------------------------------------------------
-- Tasks — credited to the assignee who did the work.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is null then return new; end if;
  begin
    if new.status::text = 'completed' and coalesce(old.status::text,'') is distinct from 'completed' then
      perform public.ams_ingest_event(
        new.assigned_to, 'task.completed', 'tm_tasks', new.id::text, 1,
        now(), 'trigger', '{}'::jsonb);
    end if;
    -- Approval is a separate, harder milestone, so it is its own event rather
    -- than a bonus on completion.
    if new.status::text = 'approved' and coalesce(old.status::text,'') is distinct from 'approved' then
      perform public.ams_ingest_event(
        new.assigned_to, 'task.approved', 'tm_tasks', new.id::text, 1,
        now(), 'trigger', '{}'::jsonb);
    end if;
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists ams_task_activity on public.tm_tasks;
create trigger ams_task_activity
  after update on public.tm_tasks
  for each row execute function public.ams_on_task();

-- ---------------------------------------------------------------------------
-- Campaigns — credited to the owner.
-- ---------------------------------------------------------------------------
create or replace function public.ams_on_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'completed' and coalesce(old.status::text,'') is distinct from 'completed'
     and new.owner_id is not null then
    begin
      perform public.ams_ingest_event(
        new.owner_id, 'campaign.delivered', 'marketing_campaigns', new.id::text, 1,
        now(), 'trigger', '{}'::jsonb);
    exception when others then null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists ams_campaign_delivered on public.marketing_campaigns;
create trigger ams_campaign_delivered
  after update on public.marketing_campaigns
  for each row execute function public.ams_on_campaign();

-- ---------------------------------------------------------------------------
-- Artwork — deliberately left to the existing registry.
--
-- The 180 stage renders live in src/assets/trophy-stages and are resolved by
-- src/lib/ams/trophy-stage-assets.ts through Vite's import.meta.glob, which
-- emits content-hashed bundle URLs. Writing a guessed "/ams/..." path into
-- trophies.image_url would have produced 180 broken images, so image_url stays
-- null and the UI keys artwork off the trophy slug, which is already exactly
-- the filename. The catalogue and the artwork are joined by name, not by a
-- duplicated URL that could drift.
-- The order trigger, repointed at the tables that actually exist.
--
-- My first version joined `order_items`, which is not a table in this database;
-- the real one is `marketplace_order_items`, and it records `seller_id` on the
-- line itself. Because the trigger swallows its own errors so it can never
-- block a payment, that mistake would not have raised anything — it would
-- simply have credited nobody, forever, while looking wired up. Worth stating
-- plainly, since a silent no-op is the failure mode this whole module is
-- supposed to avoid.
--
-- An order can legitimately earn recognition for more than one person: the
-- seller who fulfilled it, and whoever it was attributed to. Each is credited
-- from a record the commerce side already writes, never inferred. The dedupe
-- key carries the person as well as the event, so three people on one order
-- count once each rather than colliding.

create or replace function public.ams_on_order_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status::text = 'paid' and coalesce(old.status::text,'') is distinct from 'paid' then
    begin
      -- The seller who fulfilled each line.
      for r in
        select distinct oi.seller_id as who
        from public.marketplace_order_items oi
        where oi.order_id = new.id and oi.seller_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'seller'));
      end loop;

      -- The affiliate the order was attributed to.
      for r in
        select distinct ap.user_id as who
        from public.marketplace_order_attributions a
        join public.marketplace_affiliate_partners ap on ap.id = a.affiliate_partner_id
        where a.order_id = new.id and ap.user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'affiliate'));
      end loop;

      -- The influencer the order was attributed to.
      for r in
        select distinct ip.user_id as who
        from public.marketplace_order_attributions a
        join public.influencer_profiles ip on ip.id = a.influencer_profile_id
        where a.order_id = new.id and ip.user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'influencer'));
      end loop;
    exception when others then
      null;  -- Recognition never blocks a payment.
    end;
  end if;
  return new;
end $$;
