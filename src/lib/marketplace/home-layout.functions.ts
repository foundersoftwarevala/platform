import { createServerFn } from "@tanstack/react-start";
import { onCatalogueChange } from "@/lib/marketplace/catalogue-invalidation";
import { callVpsPublicFunction } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * The composition of the home page, resolved before the page is sent.
 *
 * Layout Order lives in marketplace_homepage_sections and the manager has
 * always written to it correctly. What was missing was the page reading it at
 * the right moment: the first version of this gate ran in the browser after
 * hydration, so a section the manager had switched off still rendered for one
 * frame before vanishing, and a reordered page visibly reshuffled itself.
 *
 * Resolving it here means the HTML that leaves the server already has the
 * sections the manager asked for, in the order they asked for, and nothing
 * moves after it arrives.
 *
 * It reads through mm_homepage_sections() rather than the table. The function
 * is SECURITY DEFINER and returns only what a visitor could learn by scrolling
 * — which sections exist, their order, and whether they are on — and, unlike
 * the table policy, it can also report a section that is switched off. A gate
 * that has to hide something must be able to see it.
 */

// The composition is the same for every visitor and changes when a manager
// saves, not between requests. A short cache keeps a round trip off the front
// page without making the manager wait to see their own change.
const CACHE_MS = 30_000;
let cached: { at: number; payload: HomeLayout } | null = null;
// Emptied by a Manager write (catalogue-invalidation.ts), not only by time.
onCatalogueChange(() => {
  cached = null;
});

export type HomeSectionLayout = {
  key: string;
  sortOrder: number;
  /**
   * Whether the section is on right now. The database folds enabled, status
   * and the scheduling window into this one flag, so a section scheduled for
   * next week is not live today.
   */
  liveNow: boolean;
  visibleMobile: boolean;
  visibleDesktop: boolean;
};

/**
 * The registry is authoritative. An empty list or a failed read renders no
 * managed sections rather than exposing content the database did not publish.
 */
export type HomeLayout = HomeSectionLayout[];

export const getHomeLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeLayout> => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) return cached.payload;

    try {
      const raw = await callVpsPublicFunction("mm_homepage_sections");
      if (!Array.isArray(raw)) throw new Error("The homepage section response is invalid.");

      const rows: HomeSectionLayout[] = [];
      for (const item of raw) {
        if (item === null || Array.isArray(item) || typeof item !== "object") continue;
        const key = typeof item.key === "string" ? item.key : "";
        if (!key) continue;
        rows.push({
          key,
          sortOrder: Number(item.sort_order ?? 0),
          liveNow: item.live_now === true,
          visibleMobile: item.visible_mobile === true,
          visibleDesktop: item.visible_desktop === true,
        });
      }
      rows.sort((a, b) => a.sortOrder - b.sortOrder);
      cached = { at: now, payload: rows };
      return rows;
    } catch (error) {
      console.error("[home layout] VPS section registry could not load", error);
      return [];
    }
  },
);
