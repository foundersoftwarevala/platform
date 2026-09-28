-- Give Demo Manager the categories it is supposed to offer.
--
-- The owner has twelve thousand demo URLs ready and cannot start putting them
-- in, because the category he needs to file each demo under is not on offer:
--
--   * `demo_categories` is empty. Nothing has ever been inserted into it, so
--     the screens that read it - product-demo-manager/AddDemo - show an empty
--     list.
--   * DemoAddEdit does not read it at all. It offers eight names written into
--     the file: Business, Retail, HR, Logistics, Finance, Healthcare,
--     Education, Real Estate. The marketplace has ninety-one categories, so
--     eighty-three of them could not be chosen.
--
-- The categories are taken from `marketplace_categories`, which is the
-- catalogue's own list and the one the cards, the slots and the sitemaps
-- already use. Copying the names from there rather than writing a second list
-- is what keeps a demo filed under the same category the card it belongs to is
-- filed under.
--
-- Nothing is removed and nothing is renamed. If an operator has already created
-- a demo category by hand, the insert skips that name and leaves theirs alone.
--
-- One quirk of the source, handled rather than ignored: ninety-one rows carry
-- ninety distinct names, so one name appears twice in the catalogue.
-- `demo_categories.name` is the handle Demo Manager selects by, so the
-- duplicate is collapsed to one row here - two identically named entries in a
-- dropdown is a worse problem than a category with two catalogue rows behind it.

insert into public.demo_categories (name, description, icon, display_order, is_active)
select c.name,
       'Mirrors the marketplace category of the same name.',
       nullif(btrim(coalesce(c.icon, '')), ''),
       -- The catalogue's own order, with the name as the tie-break so the list
       -- is stable rather than whichever row the planner reached first.
       row_number() over (order by coalesce(c.sort_order, 9999), c.name),
       true
  from (
    select distinct on (name) name, icon, sort_order
      from public.marketplace_categories
     order by name, coalesce(sort_order, 9999)
  ) c
 where not exists (
   select 1 from public.demo_categories d
    where lower(btrim(d.name)) = lower(btrim(c.name))
 );

-- Selecting a category by name is what the screens do, so two rows with the
-- same name must not be possible from here on.
create unique index if not exists demo_categories_name_key
  on public.demo_categories (lower(btrim(name)));

comment on table public.demo_categories is
  'The categories a demo can be filed under. Seeded from marketplace_categories so a demo is filed under the same category as the card it belongs to; an operator may add more.';
