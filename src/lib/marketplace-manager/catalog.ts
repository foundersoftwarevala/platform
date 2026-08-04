/**
 * Catalog data layer for the Marketplace Manager (products, categories,
 * homepage sections). Client-side store with the same call signatures the
 * sections expect: `fn()` for reads, `fn({ data })` for writes.
 */
import { createTable, slugify, uid } from "./store";

export type Category = {
  id: string; slug: string; name: string; icon: string | null; image_key: string | null;
  tone: string | null; sort_order: number; is_featured: boolean; is_hidden: boolean;
};

export type Product = {
  id: string; slug: string; name: string; industry_label: string | null; icon: string | null;
  price_label: string; price_period: string | null; rating: number; downloads: number;
  downloads_label: string | null; badge: "NEW" | "HOT" | "TOP" | "DEAL" | null;
  is_featured: boolean; is_trending: boolean; is_new_release: boolean; is_best_seller: boolean;
  is_ai: boolean; category_id: string | null; sort_order: number; visible: boolean;
  publish_at: string | null; unpublish_at: string | null;
};

export type Section = { id: string; key: string; title: string; enabled: boolean; sort_order: number };

const SEED_CATEGORIES: Category[] = [
  { id: "cat-erp", slug: "erp", name: "ERP & Operations", icon: "Building2", image_key: null, tone: "cyan", sort_order: 0, is_featured: true, is_hidden: false },
  { id: "cat-crm", slug: "crm", name: "CRM & Sales", icon: "Handshake", image_key: null, tone: "violet", sort_order: 1, is_featured: true, is_hidden: false },
  { id: "cat-hrm", slug: "hrm", name: "HRM & Payroll", icon: "Users2", image_key: null, tone: "emerald", sort_order: 2, is_featured: false, is_hidden: false },
  { id: "cat-ai", slug: "ai-tools", name: "AI Tools", icon: "Sparkles", image_key: null, tone: "amber", sort_order: 3, is_featured: true, is_hidden: false },
  { id: "cat-edu", slug: "education", name: "Education & LMS", icon: "GraduationCap", image_key: null, tone: "sky", sort_order: 4, is_featured: false, is_hidden: false },
];

const SEED_PRODUCTS: Product[] = [
  {
    id: "prd-erp-suite", slug: "vala-erp-suite", name: "Vala ERP Suite", industry_label: "Manufacturing",
    icon: "Building2", price_label: "$249", price_period: "/mo", rating: 4.8, downloads: 12400,
    downloads_label: "12.4k", badge: "TOP", is_featured: true, is_trending: true, is_new_release: false,
    is_best_seller: true, is_ai: false, category_id: "cat-erp", sort_order: 0, visible: true,
    publish_at: null, unpublish_at: null,
  },
  {
    id: "prd-crm-pro", slug: "vala-crm-pro", name: "Vala CRM Pro", industry_label: "Sales",
    icon: "Handshake", price_label: "$99", price_period: "/mo", rating: 4.6, downloads: 8300,
    downloads_label: "8.3k", badge: "HOT", is_featured: true, is_trending: true, is_new_release: false,
    is_best_seller: false, is_ai: false, category_id: "cat-crm", sort_order: 1, visible: true,
    publish_at: null, unpublish_at: null,
  },
  {
    id: "prd-ai-desk", slug: "vala-ai-deskmate", name: "Vala AI Deskmate", industry_label: "Support",
    icon: "Sparkles", price_label: "$59", price_period: "/mo", rating: 4.9, downloads: 5600,
    downloads_label: "5.6k", badge: "NEW", is_featured: true, is_trending: false, is_new_release: true,
    is_best_seller: false, is_ai: true, category_id: "cat-ai", sort_order: 2, visible: true,
    publish_at: null, unpublish_at: null,
  },
];

const SEED_SECTIONS: Section[] = [
  { id: "sec-hero", key: "hero", title: "Hero Banner", enabled: true, sort_order: 0 },
  { id: "sec-categories", key: "categories", title: "Category Slider", enabled: true, sort_order: 1 },
  { id: "sec-featured", key: "featured", title: "Featured Products", enabled: true, sort_order: 2 },
  { id: "sec-trending", key: "trending", title: "Trending Now", enabled: true, sort_order: 3 },
  { id: "sec-best", key: "best_sellers", title: "Best Sellers", enabled: true, sort_order: 4 },
  { id: "sec-new", key: "new_releases", title: "New Releases", enabled: true, sort_order: 5 },
  { id: "sec-ai", key: "ai_products", title: "AI Ready", enabled: true, sort_order: 6 },
  { id: "sec-vendors", key: "vendors", title: "Top Vendors", enabled: true, sort_order: 7 },
  { id: "sec-offers", key: "offers", title: "Offers & Deals", enabled: false, sort_order: 8 },
  { id: "sec-footer", key: "footer", title: "Footer", enabled: true, sort_order: 9 },
];

const categories = createTable<Category>("categories", SEED_CATEGORIES);
const products = createTable<Product>("products", SEED_PRODUCTS);
const sections = createTable<Section>("sections", SEED_SECTIONS);

const sortBy = <T extends { sort_order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

export async function listProductsAdmin(): Promise<Product[]> {
  return sortBy(products.all());
}

export async function upsertProduct(arg: { data: Partial<Product> }): Promise<Product> {
  const input = arg.data;
  const id = input.id ?? uid();
  const existing = input.id ? products.find(input.id) : undefined;
  const row: Product = {
    ...(existing ?? {
      id, slug: "", name: "", industry_label: null, icon: "Sparkles", price_label: "",
      price_period: null, rating: 0, downloads: 0, downloads_label: null, badge: null,
      is_featured: false, is_trending: false, is_new_release: false, is_best_seller: false,
      is_ai: false, category_id: null, sort_order: products.all().length, visible: true,
      publish_at: null, unpublish_at: null,
    }),
    ...input,
    id,
  };
  row.slug = row.slug || slugify(row.name, "product");
  return products.upsert(row);
}

export async function deleteProduct(arg: { data: { id: string } }) {
  products.remove(arg.data.id);
  return { ok: true };
}

export async function listCategoriesAdmin(): Promise<Category[]> {
  return sortBy(categories.all());
}

export async function upsertCategory(arg: { data: Partial<Category> }): Promise<Category> {
  const input = arg.data;
  const id = input.id ?? uid();
  const existing = input.id ? categories.find(input.id) : undefined;
  const row: Category = {
    ...(existing ?? {
      id, slug: "", name: "", icon: "Layers", image_key: null, tone: null,
      sort_order: categories.all().length, is_featured: false, is_hidden: false,
    }),
    ...input,
    id,
  };
  row.slug = row.slug || slugify(row.name, "category");
  return categories.upsert(row);
}

export async function deleteCategory(arg: { data: { id: string } }) {
  categories.remove(arg.data.id);
  return { ok: true };
}

export async function listSectionsAdmin(): Promise<Section[]> {
  return sortBy(sections.all());
}

export async function setSectionEnabled(arg: { data: { key: string; enabled: boolean } }) {
  const row = sections.all().find((s) => s.key === arg.data.key);
  if (row) sections.patch(row.id, { enabled: arg.data.enabled });
  return { ok: true };
}

export async function reorderSections(arg: { data: { order: { key: string; sort_order: number }[] } }) {
  const map = new Map(arg.data.order.map((o) => [o.key, o.sort_order]));
  sections.replace(sections.all().map((s) => (map.has(s.key) ? { ...s, sort_order: map.get(s.key)! } : s)));
  return { ok: true };
}
