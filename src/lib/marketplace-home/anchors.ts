/**
 * Anchor ids for the marketplace home page.
 *
 * Every product row is rendered by `CategoryRow` under its category's name, and
 * exposes `categoryAnchor(name)` as its fragment id. Category links elsewhere
 * go to the category's own page (/marketplace/category/<slug>); in-page links
 * only jump to the product grid.
 */

/** The id of the section that holds the whole product grid. */
export const GRID_ANCHOR = "all";

export function categoryAnchor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Smooth-scrolls to a fragment without letting the router treat the hash as a
 * navigation. Used by every in-page link so the jump works on the SPA.
 */
export function scrollToAnchor(id: string) {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof history !== "undefined") history.replaceState(null, "", `#${id}`);
  return true;
}

/**
 * onClick handler for an in-page `#anchor` link. A row that is not on the page
 * (not loaded yet) falls back to the product grid rather than doing nothing.
 */
export function anchorClick(id: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    if (scrollToAnchor(id) || scrollToAnchor(GRID_ANCHOR)) e.preventDefault();
  };
}
