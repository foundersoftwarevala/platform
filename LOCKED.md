# LOCKED — Marketplace Homepage and Marketplace Manager

This is the approved copy of the storefront. The design in these files is final;
work on them connects them to real data, it does not redesign them.

    tag: marketplace-locked-20260908   (the approved design)

## The one marketplace

There is one marketplace homepage, one catalogue data flow, one search and one
category system. If you are looking for "the other version" of any of these,
there is none.

| What | Where |
|---|---|
| Homepage | `src/components/marketplace-home/HomeIndex.tsx`, served at `/` (`src/routes/index.tsx`) and `/marketplace` (`src/routes/marketplace.index.tsx`) with the same loader |
| Homepage sections | `src/components/marketplace-home/*` (RefSections, CategorySlider, HeroCarousel, TopUtilityBar, …) |
| First page of rows (server-rendered) | `getHomeCatalog` in `src/lib/marketplace/home-catalog.functions.ts` |
| Later rows and "load more" | `/api/marketplace/catalog` |
| The catalogue reader behind both | `src/lib/marketplace/catalog.server.ts` (applies the manager's row configuration, schedules and hand-placed order) |
| The product card | `src/lib/marketplace/catalog-card.ts` (`CARD_FIELDS`, `toCard`, `CatalogCard`), drawn by `DemoCard` in `HomeIndex.tsx` |
| Search | `/api/marketplace/search` — the homepage box (`format=cards`) and the AI finder / recommend / compare tools |
| Categories | table `marketplace_categories`: homepage rows, the category strip and the industry grid (`/api/marketplace/rows`), category pages (`/marketplace/category/<slug>`) |
| Products | table `marketplace_products` (public = `visible` and `content_status = published`) |
| Homepage layout | table `marketplace_homepage_sections` via `mm_homepage_sections`; edited in Marketplace Manager → Layout Order |
| Hero slides | table `home_hero_slides`: storefront `src/lib/marketplace-content/hero.functions.ts`, manager `src/lib/hero-slides.ts` |
| Catalogue admin | Marketplace Manager → Products / Categories / Layout Order, through the server functions in `src/lib/marketplace.functions.ts` |

The Marketplace Manager is `src/components/marketplace-manager/` with its route
`src/routes/marketplace-manager.tsx` — the workspace the Control Panel sidebar
opens. No second shell, sidebar or section router.

## Rules

1. **One of each.** One homepage, one catalogue reader, one card, one search,
   one category system. Extend them; never add a parallel one.
2. **No copies.** Do not create `X.new.tsx`, `X-v2.tsx`, `XCanonical.tsx`, a
   `.backup`, an `/old` or `/legacy` folder, or an archive in the repository.
   Git holds every previous version. A duplicate or obsolete implementation,
   once its useful parts are migrated and nothing depends on it, is deleted
   outright — not archived, renamed or commented out.
3. **Real data only.** Products, categories, counts and prices come from the
   database. No product list, category list or number is written into a page.
4. **The UI is the specification.** Connect the design to real data; do not
   redesign it, and do not substitute a component for one written from scratch.
5. **Colour: density may change, hue may not.** The depth layer at the end of
   `marketplace-home.css` raises saturation, contrast and shadow depth only.

## How to compare against the approved design

    git diff marketplace-locked-20260908 -- src/components/marketplace-home
    git diff marketplace-locked-20260908 -- src/components/marketplace-manager
