import { createServerFn } from "@tanstack/react-start";

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
 * Null means "the registry could not be read". That is deliberately different
 * from an empty list: null tells the page to render its built-in order, while
 * an empty list would mean the manager had switched everything off. The home
 * page is a protected route, so an unreadable registry must never empty it.
 */
export type HomeLayout = HomeSectionLayout[] | null;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export const getHomeLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeLayout> => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) return cached.payload;

    const base = url();
    if (!base) return null;

    try {
      const res = await fetch(`${base}/rest/v1/rpc/mm_homepage_sections`, {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return null;

      const raw = (await res.json()) as unknown;
      if (!Array.isArray(raw) || raw.length === 0) return null;

      const rows: HomeSectionLayout[] = [];
      for (const item of raw as Record<string, unknown>[]) {
        const key = typeof item.key === "string" ? item.key : "";
        if (!key) continue;
        rows.push({
          key,
          sortOrder: Number(item.sort_order ?? 0),
          liveNow: item.live_now !== false,
          // Device targeting defaults to shown. A registry that has not been
          // told otherwise should never hide a section from anybody.
          visibleMobile: item.visible_mobile !== false,
          visibleDesktop: item.visible_desktop !== false,
        });
      }
      if (rows.length === 0) return null;

      rows.sort((a, b) => a.sortOrder - b.sortOrder);
      cached = { at: now, payload: rows };
      return rows;
    } catch {
      // Every failure path returns null, which renders the built-in order.
      return null;
    }
  },
);
