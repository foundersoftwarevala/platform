/**
 * Canonical anchor ids for the marketplace home page.
 *
 * Every product row on the home page is rendered by `CategoryRow`, which is
 * keyed by its master-category name ("Hospitality (Hotel, Restaurant, Travel)").
 * Raw names make terrible fragment ids — they carry spaces, ampersands and
 * brackets — so every in-page link goes through `categoryAnchor()` and every row
 * exposes the same slug. `resolveCategory()` maps the short marketing labels used
 * by the pills and the industry grid onto the master-category names that actually
 * exist in the catalogue, so a pill can never point at a row that is not rendered.
 */
import { allMasterCategories55 } from "@/data/extraDemos";

/** The id of the section that holds the whole product grid. */
export const GRID_ANCHOR = "all";
/** The id of the row that lists the visitor's saved products. */
export const FAVORITES_ANCHOR = "favorites";

export function categoryAnchor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Short label -> real master category. Anything not listed here is matched
 * against the catalogue directly (exact, then prefix, then word overlap).
 */
const ALIASES: Record<string, string> = {
  "restaurant & pos": "Hospitality (Hotel, Restaurant, Travel)",
  restaurant: "Hospitality (Hotel, Restaurant, Travel)",
  "hotel & hospitality": "Hospitality (Hotel, Restaurant, Travel)",
  hospitality: "Hospitality (Hotel, Restaurant, Travel)",
  hotel: "Hospitality (Hotel, Restaurant, Travel)",
  travel: "Hospitality (Hotel, Restaurant, Travel)",
  "retail & pos": "Retail & POS",
  retail: "Retail & POS",
  pos: "Retail & POS",
  "e-commerce": "E-commerce & Online Marketplaces",
  ecommerce: "E-commerce & Online Marketplaces",
  automotive: "Automobile",
  automobile: "Automobile",
  hr: "HR & Payroll",
  "hr & payroll": "HR & Payroll",
  enterprise: "Enterprise Resource Planning (ERP)",
  erp: "Enterprise Resource Planning (ERP)",
  government: "Government & e-Governance Systems",
  legal: "Legal, Compliance & Documentation",
  security: "Security, Surveillance & Access Control",
  "cyber security": "Cyber Security & Data Protection",
  support: "Customer Support & Helpdesk",
  services: "Customer Support & Helpdesk",
  helpdesk: "Customer Support & Helpdesk",
  "it & saas": "Cloud & DevOps",
  it: "Cloud & DevOps",
  saas: "Cloud & DevOps",
  logistics: "Inventory, Warehouse & Supply Chain",
  "supply chain": "Inventory, Warehouse & Supply Chain",
  telecom: "Telecom, Call Center & VoIP",
  "ai & automation": "AI & Automation",
  ai: "AI & Automation",
  academy: "Academy",
};

/**
 * Returns the master category a label refers to, or `null` when the catalogue
 * has no row for it — callers then fall back to the whole grid instead of
 * emitting a link that scrolls nowhere.
 */
export function resolveCategory(label: string): string | null {
  const key = label.trim().toLowerCase();
  const alias = ALIASES[key];
  if (alias && allMasterCategories55.includes(alias)) return alias;

  const exact = allMasterCategories55.find((c) => c.toLowerCase() === key);
  if (exact) return exact;

  const prefix = allMasterCategories55.find((c) => c.toLowerCase().startsWith(key));
  if (prefix) return prefix;

  const contains = allMasterCategories55.find((c) => c.toLowerCase().includes(key));
  return contains ?? null;
}

/** Href for an in-page category link — falls back to the full grid. */
export function categoryHref(label: string): string {
  const category = resolveCategory(label);
  return `#${category ? categoryAnchor(category) : GRID_ANCHOR}`;
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
 * onClick handler for an in-page `#anchor` link.
 *
 * The home page only renders a row for a master category that actually has
 * products, and which categories those are is decided by the database at
 * request time. So a pill can name a real category whose row is not on the page
 * today. Rather than leaving the click dead, it falls back to the product grid.
 */
export function anchorClick(id: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    if (scrollToAnchor(id) || scrollToAnchor(GRID_ANCHOR)) e.preventDefault();
  };
}
