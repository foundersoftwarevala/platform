# LOCKED — Sapphire Homepage and Marketplace Manager

The approved public homepage is the premium Sapphire storefront shown at `/`.
Its header, announcements, hero, 3D product cards, product rows, social sharing,
and footer are locked. Connect and repair existing data flows; do not redesign,
replace, remove, or duplicate the homepage.

## The one homepage

There is one active public homepage: `src/routes/index.tsx` renders
`src/components/sapphire-home/HomeIndex.tsx` with
`src/styles/sapphire-home.css`. `/marketplace/` redirects to `/`; the Marketplace
Manager, product pages, category pages, APIs, and catalogue remain available.
Do not reactivate the retired Marketplace homepage at `/`.

| What                                | Where                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Homepage route                      | `src/routes/index.tsx`                                                         |
| Homepage sections and product cards | `src/components/sapphire-home/*`                                               |
| Homepage visual system              | `src/styles/sapphire-home.css`                                                 |
| Static seeded demo cards            | `allDemos` in `src/data/catalogue.ts`                                          |
| Country catalogue cards             | `fetchCountryRail` in `src/lib/marketplace/country-rail.ts`                    |
| Product and demo destinations       | Existing `/marketplace/product/<slug>` and `/demo/<slug>` routes               |
| Marketplace administration          | `src/components/marketplace-manager/` and `src/routes/marketplace-manager.tsx` |

## Permanent homepage rules

1. **One active homepage.** The Sapphire route above is canonical. Preserve its
   Login/navigation, announcement and feature banners, hero, product details,
   Features and Tech Stack tabs, Live Demo, Buy Now, square social-share menu,
   lower sections, links, forms, and footer.
2. **Exactly 100 cards in each populated product row.** The shared
   `HOMEPAGE_CARDS_PER_ROW`/`fillProductRail` contract is covered by
   `src/lib/marketplace/product-rail.test.ts`. Repeat only existing real cards
   to fill a short row. When a source row has more than 100 products, keep live
   demo products first and cap only the homepage presentation. Do not delete,
   rewrite, or lose catalogue records, details, or active demo URLs; overflow
   remains in the catalogue and its existing routes.
3. **Country cards share the same 100-card limit.** They can use only remaining
   row capacity; do not append a second unbounded rail to a full row.
4. **No duplicate implementations.** Keep one homepage route, one Sapphire
   card implementation, and the existing Marketplace Manager and catalogue.
   Do not add a parallel homepage or a second version of a component.
5. **Preserve source data and routes.** Card selection changes only what is
   visible in this homepage row. It never removes products or changes their
   destinations, demo URLs, business data, or permissions.
6. **Keep the approved visual identity.** Preserve the current Sapphire colors,
   3D depth, card sizing, responsive behavior, banners, and social menu. A
   requested functional repair is not permission for an unrelated redesign.
7. **Protect this code in GitHub.** Changes to the homepage route, Sapphire
   components/styles, row-limit helper, and this lock require a reviewed PR
   from the designated code owner. GitHub branch protection is the enforcement
   mechanism; repository instructions/tests are not a security boundary.

The Marketplace Manager remains `src/components/marketplace-manager/` with its
existing route and server functions. Do not delete or merge its modules into
the public homepage.

## Verification before changing the homepage

- Run the focused product-rail tests and the repository typecheck/build.
- Confirm each populated, unfiltered row renders 100 cards, including after
  country-card loading.
- Confirm live demos are preferred when a source row must be capped.
- Confirm overflow products and all existing demo/product routes remain.
- Preserve the Login, top banners, hero, social-share actions, and lower
  homepage sections in the browser.
