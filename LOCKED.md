# LOCKED — Marketplace Homepage and Marketplace Manager

This is the approved copy. It is tagged, and the tag is what any future work is
compared against.

    tag: marketplace-locked-20260908

## What is locked

**The storefront homepage**

    src/components/marketplace-home/HomeIndex.tsx
    src/components/marketplace-home/RefSections.tsx
    src/components/marketplace-home/CategoryRow.tsx
    src/components/marketplace-home/CategorySlider.tsx
    src/components/marketplace-home/HeroCarousel.tsx
    src/components/marketplace-home/FeatureStrip.tsx
    src/components/marketplace-home/FestiveBanner.tsx
    src/components/marketplace-home/FloatingElements.tsx
    src/components/marketplace-home/SiteFooter.tsx
    src/components/marketplace-home/TopUtilityBar.tsx
    src/components/marketplace-home/UtilityStrip.tsx
    src/components/marketplace-home/SectionBoundary.tsx
    src/styles/marketplace-home.css
    src/lib/marketplace-content/hero.functions.ts

**The one Marketplace Manager**

    src/components/marketplace-manager/            (the workspace the Control
                                                    Panel sidebar opens)
    src/routes/marketplace-manager.tsx

## The rules this copy is locked under

1. **One homepage.** `HomeIndex.tsx` is the only marketplace homepage. There is
   no `_NEW`, no `Canonical`, no `.refactored` copy in `src/` any more — 218 such
   files were moved to `_archive/src-legacy-20260908/` on 8 September because
   they kept turning up in searches and being mistaken for live code. They are
   archived, not deleted; every one of them is still in git history and on disk.

2. **One Marketplace Manager.** The workspace the Control Panel sidebar opens.
   No second shell, no second sidebar, no second section router over the same
   sections.

3. **No new copy.** Work on these files in place. Do not create `X.new.tsx`,
   `X-v2.tsx`, `XCanonical.tsx` or a `.backup` beside them — that is how the
   duplicates happened. Git already holds every previous version.

4. **Nothing is deleted.** Additive changes and rewiring only. If something has
   to be replaced, keep the old code under a new name outside `src/`.

5. **The UI is the specification.** The design in these files is final. Connect
   it to real data; do not redesign it, and do not substitute a component for one
   written from scratch.

6. **Colour: density may change, hue may not.** The depth layer at the end of
   `marketplace-home.css` raises saturation, contrast and shadow depth only. No
   rule in it sets a hue.

## How to compare against the lock

    git diff marketplace-locked-20260908 -- src/components/marketplace-home
    git diff marketplace-locked-20260908 -- src/components/marketplace-manager

Anything that shows up there is a change made since the lock, and should be
deliberate.

## Where the archived files went

    _archive/src-legacy-20260908/     218 files, 4.6 MB

Nothing in `src/` imports any of them — verified before the move, with a build
afterwards to confirm.
