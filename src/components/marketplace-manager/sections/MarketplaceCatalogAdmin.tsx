// DB-backed catalog admin used by ProductsSection & CategoriesSection.
// Reads/writes through server functions in @/lib/marketplace.functions.
import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { toast } from "sonner";
import { Plus, Save, Trash2, X, Loader2, Edit3, Eye, EyeOff } from "lucide-react";
import {
  listProductsAdmin, listProductsAdminPage, upsertProduct, deleteProduct,
  layoutHistory, layoutRestore,
  listCategoriesAdmin, upsertCategory, deleteCategory,
  listSectionsAdmin, setSectionEnabled, reorderSections,
} from "@/lib/marketplace.functions";
import { Card, LoadFailure, PageHeader, PillButton } from "../ui";
import { useTranslation } from "@/lib/i18n/use-translation";

type Category = {
  id: string; slug: string; name: string; icon: string | null; image_key: string | null;
  tone: string | null; sort_order: number; is_featured: boolean; is_hidden: boolean;
};
type Product = {
  id: string; slug: string; name: string; industry_label: string | null; icon: string | null;
  price_label: string; price_period: string | null; rating: number; downloads: number;
  downloads_label: string | null; badge: "NEW"|"HOT"|"TOP"|"DEAL"|null;
  is_featured: boolean; is_trending: boolean; is_new_release: boolean; is_best_seller: boolean;
  is_ai: boolean; category_id: string | null; sort_order: number; visible: boolean;
  publish_at: string | null; unpublish_at: string | null;
};

/* ---------------- Products Admin ---------------- */

const EMPTY_PRODUCT: Partial<Product> = {
  slug: "", name: "", industry_label: "", icon: "Sparkles",
  price_label: "", price_period: null, rating: 0, downloads: 0, downloads_label: null,
  badge: null, is_featured: false, is_trending: false, is_new_release: false,
  is_best_seller: false, is_ai: false, category_id: null, sort_order: 0, visible: true,
  publish_at: null, unpublish_at: null,
};

export function ProductsAdmin() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listProductsAdminPage);
  const upsertFn = useServerFn(upsertProduct);
  const deleteFn = useServerFn(deleteProduct);

  // One page at a time, counted by the database.
  //
  // This asked for every column of every row and drew all of them: measured on
  // the live console, 7,390 rows arriving as 476,660 characters and 15,297
  // controls in one DOM. It is slow now and it breaks later, because PostgREST
  // caps a result at 10,000 rows and would simply stop returning the newest
  // products without saying so.
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const pageSize = 50;

  const { data: paged, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["mp_products_admin", page, term],
    queryFn: async () =>
      (await listFn({ data: { page, pageSize, search: term } })) as unknown as {
        rows: Product[]; total: number; ok: boolean; error?: string;
      },
  });
  const data: Product[] = paged?.rows ?? [];
  const total = paged?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: Partial<Product>) => upsertFn({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_products_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success(t("storeadmin.catalog.product_saved"));
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_products_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success(t("storeadmin.catalog.product_deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={t("storeadmin.catalog.products_eyebrow")}
        title={t("storeadmin.catalog.products_title")}
        description={t("storeadmin.catalog.products_description")}
        actions={
          <PillButton variant="primary" onClick={() => setEditing({ ...EMPTY_PRODUCT })}>
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> {t("storeadmin.catalog.new_product")}</span>
          </PillButton>
        }
      />

      {isError ? (
        <LoadFailure error={error} what={t("storeadmin.catalog.what_products")} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t("storeadmin.catalog.loading")}</div>
      ) : data.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground">{t("storeadmin.catalog.products_empty")}</div></Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>{t("storeadmin.catalog.col_name")}</Th><Th>{t("storeadmin.catalog.col_slug")}</Th><Th>{t("storeadmin.catalog.col_price")}</Th><Th>{t("storeadmin.catalog.col_badge")}</Th>
                <Th>{t("storeadmin.catalog.col_flags")}</Th><Th>{t("storeadmin.catalog.col_visible")}</Th><Th>{t("storeadmin.catalog.col_order")}</Th><Th>{t("storeadmin.catalog.col_actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-muted-foreground">{p.slug}</Td>
                  <Td>{p.price_label || "—"}{p.price_period ? ` / ${p.price_period}` : ""}</Td>
                  <Td>{p.badge ?? "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {p.is_featured && <Chip>{t("storeadmin.catalog.chip_featured")}</Chip>}
                      {p.is_trending && <Chip>{t("storeadmin.catalog.chip_trending")}</Chip>}
                      {p.is_best_seller && <Chip>{t("storeadmin.catalog.chip_best")}</Chip>}
                      {p.is_new_release && <Chip>{t("storeadmin.catalog.chip_new")}</Chip>}
                      {p.is_ai && <Chip>{t("storeadmin.catalog.chip_ai")}</Chip>}
                    </div>
                  </Td>
                  <Td>{p.visible ? <Eye className="h-4 w-4 text-emerald-400"/> : <EyeOff className="h-4 w-4 text-muted-foreground"/>}</Td>
                  <Td>{p.sort_order}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <IconBtn onClick={() => setEditing(p)} label={t("storeadmin.catalog.edit")}><Edit3 className="h-3.5 w-3.5"/></IconBtn>
                      <IconBtn onClick={() => { if (confirm(t("storeadmin.catalog.confirm_delete", { name: p.name }))) delMut.mutate(p.id); }} label={t("storeadmin.catalog.delete")}><Trash2 className="h-3.5 w-3.5"/></IconBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Added, not replaced: the table above is unchanged, and this says how
          much of the catalogue it is showing and how to reach the rest. */}
      {!isError && !isLoading && total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {t("storeadmin.catalog.range_of_products", { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, total), total: total.toLocaleString() })}
          </span>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setTerm(search.trim()); setPage(0); }
              }}
              placeholder={t("storeadmin.catalog.search_products_placeholder")}
              aria-label={t("storeadmin.catalog.search_products")}
              className="h-8 w-56 rounded-md border border-border bg-transparent px-2 text-sm"
            />
            <PillButton onClick={() => { setTerm(search.trim()); setPage(0); }}>{t("storeadmin.catalog.search")}</PillButton>
            <PillButton onClick={() => setPage((v) => Math.max(0, v - 1))} disabled={page <= 0}>{t("storeadmin.catalog.previous")}</PillButton>
            <span>{t("storeadmin.catalog.page_of", { page: page + 1, pages: lastPage + 1 })}</span>
            <PillButton onClick={() => setPage((v) => Math.min(lastPage, v + 1))} disabled={page >= lastPage}>{t("storeadmin.catalog.next")}</PillButton>
          </div>
        </div>
      ) : null}

      {editing && (
        <ProductEditor
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={(v) => upsertMut.mutate(v)}
          saving={upsertMut.isPending}
        />
      )}
    </div>
  );
}

function ProductEditor({
  value, onCancel, onSave, saving,
}: {
  value: Partial<Product>;
  onCancel: () => void;
  onSave: (v: Partial<Product>) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<Partial<Product>>(value);
  const set = <K extends keyof Product>(k: K, val: Product[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{v.id ? t("storeadmin.catalog.edit_product") : t("storeadmin.catalog.new_product")}</h3>
          <button onClick={onCancel}><X className="h-4 w-4"/></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("storeadmin.catalog.field_name")}><input className={inp} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_slug")}><input className={inp} value={v.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></Field>
          <Field label={t("storeadmin.catalog.field_industry_label")}><input className={inp} value={v.industry_label ?? ""} onChange={(e) => set("industry_label", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_icon")}><input className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_price_label")}><input className={inp} value={v.price_label ?? ""} onChange={(e) => set("price_label", e.target.value)} placeholder={t("storeadmin.catalog.price_label_placeholder")}/></Field>
          <Field label={t("storeadmin.catalog.field_price_period")}><input className={inp} value={v.price_period ?? ""} onChange={(e) => set("price_period", e.target.value)} placeholder={t("storeadmin.catalog.price_period_placeholder")}/></Field>
          <Field label={t("storeadmin.catalog.field_rating")}><input type="number" step="0.1" className={inp} value={v.rating ?? 0} onChange={(e) => set("rating", Number(e.target.value))} /></Field>
          <Field label={t("storeadmin.catalog.field_downloads")}><input type="number" className={inp} value={v.downloads ?? 0} onChange={(e) => set("downloads", Number(e.target.value))} /></Field>
          <Field label={t("storeadmin.catalog.field_downloads_label")}><input className={inp} value={v.downloads_label ?? ""} onChange={(e) => set("downloads_label", e.target.value)} placeholder={t("storeadmin.catalog.downloads_label_placeholder")}/></Field>
          <Field label={t("storeadmin.catalog.field_badge")}>
            <select className={inp} value={v.badge ?? ""} onChange={(e) => set("badge", (e.target.value || null) as any)}>
              <option value="">{t("storeadmin.catalog.badge_none")}</option>
              {/* i18n-ignore: stored badge codes */}
              <option>NEW</option><option>HOT</option><option>TOP</option><option>DEAL</option>
            </select>
          </Field>
          <Field label={t("storeadmin.catalog.field_sort_order")}><input type="number" className={inp} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Toggle label={t("storeadmin.catalog.toggle_visible")} v={!!v.visible} onChange={(x) => set("visible", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_featured")} v={!!v.is_featured} onChange={(x) => set("is_featured", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_trending")} v={!!v.is_trending} onChange={(x) => set("is_trending", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_best_seller")} v={!!v.is_best_seller} onChange={(x) => set("is_best_seller", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_new_release")} v={!!v.is_new_release} onChange={(x) => set("is_new_release", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_ai")} v={!!v.is_ai} onChange={(x) => set("is_ai", x)} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onCancel}>{t("storeadmin.catalog.cancel")}</PillButton>
          <PillButton variant="primary" onClick={() => onSave(v)}>
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} {t("storeadmin.catalog.save")}
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Categories Admin ---------------- */

const EMPTY_CAT: Partial<Category> = {
  slug: "", name: "", icon: "Sparkles", image_key: "", tone: "primary",
  sort_order: 0, is_featured: false, is_hidden: false,
};

export function CategoriesAdmin() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listCategoriesAdmin);
  const upsertFn = useServerFn(upsertCategory);
  const deleteFn = useServerFn(deleteCategory);

  const { data = [], isLoading, isError, error, refetch } = useQuery<Category[]>({
    queryKey: ["mp_categories_admin"], queryFn: async () => (await listFn()) as unknown as Category[],
  });

  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: Partial<Category>) => upsertFn({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_categories_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success(t("storeadmin.catalog.category_saved")); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_categories_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success(t("storeadmin.catalog.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={t("storeadmin.catalog.categories_eyebrow")}
        title={t("storeadmin.catalog.categories_title")}
        description={t("storeadmin.catalog.categories_description")}
        actions={
          <PillButton variant="primary" onClick={() => setEditing({ ...EMPTY_CAT })}>
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5"/> {t("storeadmin.catalog.new_category")}</span>
          </PillButton>
        }
      />
      {isError ? (
        <LoadFailure error={error} what={t("storeadmin.catalog.what_categories")} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> {t("storeadmin.catalog.loading")}</div>
      ) : data.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground">{t("storeadmin.catalog.categories_empty")}</div></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {c.name} {c.is_hidden && <span className="text-[10px] text-warning">{t("storeadmin.catalog.hidden_tag")}</span>}
                  {c.is_featured && <span className="rounded bg-accent/20 px-1.5 text-[10px] text-accent">{t("storeadmin.catalog.featured_tag")}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">/{c.slug} · {t("storeadmin.catalog.rank_tone", { rank: `#${c.sort_order}`, tone: c.tone ?? "—" })}</div>
              </div>
              <div className="flex gap-1">
                <IconBtn onClick={() => setEditing(c)} label={t("storeadmin.catalog.edit")}><Edit3 className="h-3.5 w-3.5"/></IconBtn>
                <IconBtn onClick={() => { if (confirm(t("storeadmin.catalog.confirm_delete", { name: c.name }))) delMut.mutate(c.id); }} label={t("storeadmin.catalog.delete")}><Trash2 className="h-3.5 w-3.5"/></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CategoryEditor value={editing} onCancel={() => setEditing(null)} onSave={(v) => upsertMut.mutate(v)} saving={upsertMut.isPending} />
      )}
    </div>
  );
}

function CategoryEditor({ value, onCancel, onSave, saving }: {
  value: Partial<Category>; onCancel: () => void; onSave: (v: Partial<Category>) => void; saving: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<Partial<Category>>(value);
  const set = <K extends keyof Category>(k: K, val: Category[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{v.id ? t("storeadmin.catalog.edit_category") : t("storeadmin.catalog.new_category")}</h3>
          <button onClick={onCancel}><X className="h-4 w-4"/></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("storeadmin.catalog.field_name")}><input className={inp} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_slug")}><input className={inp} value={v.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></Field>
          <Field label={t("storeadmin.catalog.field_icon")}><input className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_image_key")}><input className={inp} value={v.image_key ?? ""} onChange={(e) => set("image_key", e.target.value)} /></Field>
          <Field label={t("storeadmin.catalog.field_tone")}>
            <select className={inp} value={v.tone ?? "primary"} onChange={(e) => set("tone", e.target.value)}>
              {/* i18n-ignore: stored tone codes */}
              <option>primary</option><option>success</option><option>warning</option>
              {/* i18n-ignore: stored tone codes */}
              <option>gold</option><option>magenta</option><option>destructive</option>
            </select>
          </Field>
          <Field label={t("storeadmin.catalog.field_sort_order")}><input type="number" className={inp} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))}/></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Toggle label={t("storeadmin.catalog.toggle_featured")} v={!!v.is_featured} onChange={(x) => set("is_featured", x)} />
          <Toggle label={t("storeadmin.catalog.toggle_hidden")} v={!!v.is_hidden} onChange={(x) => set("is_hidden", x)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onCancel}>{t("storeadmin.catalog.cancel")}</PillButton>
          <PillButton variant="primary" onClick={() => onSave(v)}>
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} {t("storeadmin.catalog.save")}
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Homepage Layout Admin ---------------- */

type Section = { id: string; key: string; title: string; enabled: boolean; sort_order: number };

/**
 * Which manager owns a section's content.
 *
 * Layout Order owns where a section sits and whether it shows. What is IN it
 * belongs to another screen, and an operator who wants to change the hero's
 * slides should not have to go looking for Hero Banner Manager in the sidebar.
 *
 * Only sections whose owning screen actually exists in the registry are listed.
 * feature-strip, ai-zone, live-activity, vala-academy and enterprise-cta have
 * no screen of their own, so they get no button — an operator finding nothing
 * is better than one finding a control that goes nowhere.
 */
const CONFIGURED_BY: Record<string, string> = {
  "hero-carousel": "Hero Banner",
  "category-slider": "Categories",
  "shop-by-industry": "Categories",
  "shop-by-category": "Categories",
  "catalog-rows": "Homepage Rows",
  "featured-software": "Homepage Rows",
  "trending-now": "Homepage Rows",
  "top-selling": "Homepage Rows",
  "new-releases": "Homepage Rows",
  "utility-bar": "Top Bar",
  "offer-banner": "Offers",
  "search-bar": "Search",
  "success-stories": "Stories & Awards",
  "awards-champions": "Stories & Awards",
  "partner-ecosystem": "Partners",
  "floating-elements": "Sticky",
  "vala-tv": "Vala TV",
  faq: "FAQ",
  footer: "Footer",
};
/**
 * What the layout used to be, and putting it back.
 *
 * There is no "reset to default" here because there is no default: nothing in
 * the database, the migrations or the code records a canonical homepage order,
 * and inventing one would mean deciding for the owner what the right order is.
 *
 * What exists is better. Every reorder already writes its complete before and
 * after state into the audit log, so an operator can see the changes that were
 * actually made and restore any of them. The restore goes through the same
 * reorder function as any other change, and is itself audited.
 */
function LayoutHistoryPanel({ onRestored }: { onRestored: () => void }) {
  const { t } = useTranslation();
  const historyFn = useServerFn(layoutHistory);
  const restoreFn = useServerFn(layoutRestore);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["mp_layout_history"],
    queryFn: async () => (await historyFn()) as unknown as { entries: HistoryEntry[] },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { auditId: id } }),
    onSuccess: () => {
      toast.success(t("storeadmin.catalog.layout_restored"));
      onRestored();
      void refetch();
    },
    // The message the server gave, not a cheerful one of our own.
    onError: (e: Error) => toast.error(e.message),
  });

  if (isError) {
    return <LoadFailure error={error} what={t("storeadmin.catalog.what_layout_history")} onRetry={() => void refetch()} />;
  }
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("storeadmin.catalog.loading_history")}
        </div>
      </Card>
    );
  }

  const entries = data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <Card>
        <div className="text-sm text-muted-foreground">
          {t("storeadmin.catalog.history_empty")}
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <h3 className="mb-2 text-sm font-bold">{t("storeadmin.catalog.history_title")}</h3>
      <div className="grid gap-1.5">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-1.5"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold">
                {e.action.replace("section.", "").replace("layout.", "")}
                {e.section_key ? <span className="text-muted-foreground"> · {e.section_key}</span> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {e.actor_email ?? t("storeadmin.catalog.unknown")} · {new Date(e.created_at).toLocaleString()}
              </div>
            </div>
            {e.restorable ? (
              <PillButton
                onClick={() => restoreMut.mutate(e.id)}
                disabled={restoreMut.isPending}
              >
                {t("storeadmin.catalog.restore_order")}
              </PillButton>
            ) : (
              // An enable or a disable is one section, not a layout; putting it
              // back is simply toggling that section, so no button is offered
              // rather than one that would do something unexpected.
              <span className="text-[11px] text-muted-foreground">{t("storeadmin.catalog.single_section")}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

type HistoryEntry = {
  id: string;
  action: string;
  created_at: string;
  actor_email: string | null;
  section_key: string | null;
  restorable: boolean;
};
export function LayoutOrderAdmin({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listSectionsAdmin);
  const toggleFn = useServerFn(setSectionEnabled);
  const reorderFn = useServerFn(reorderSections);

  const { data = [], isLoading, isError, error, refetch } = useQuery<Section[]>({
    queryKey: ["mp_sections_admin"],
    queryFn: async () => (await listFn()) as unknown as Section[],
    // A second console open elsewhere converges on its own.
    //
    // Push would be better and is not available: no Realtime server runs
    // against this database - the VPS runs PostgREST alone - and the browser's
    // /realtime/v1/ goes to the hosted project, which no longer receives these
    // writes. Adding the table to the publication would change nothing, because
    // nothing consumes it. React Query already refetches on focus; this makes a
    // second session that is simply left open catch up too, through the query
    // layer that is already here rather than a second realtime architecture.
    refetchInterval: 30_000,
  });

  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "on" | "off">("all");
  const [showHistory, setShowHistory] = useState(false);

  // Filtering twenty-four rows in the browser is not an aggregate and not a
  // capped list: it is the whole registry, already loaded, being narrowed.
  const shown = data.filter((s) => {
    if (only === "on" && !s.enabled) return false;
    if (only === "off" && s.enabled) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.title.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mp_sections_admin"] });
    qc.invalidateQueries({ queryKey: ["marketplace"] });
  };

  const toggleMut = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => toggleFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: (order: { key: string; sort_order: number }[]) => reorderFn({ data: { order } }),
    onSuccess: () => { invalidate(); toast.success(t("storeadmin.catalog.order_saved")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...data];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[idx]!;
    const b = next[j]!;
    next[idx] = b;
    next[j] = a;
    const payload = next.map((s, i) => ({ key: s.key, sort_order: (i + 1) * 10 }));
    reorderMut.mutate(payload);
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={t("storeadmin.catalog.layout_eyebrow")}
        title={t("storeadmin.catalog.layout_title")}
        description={t("storeadmin.catalog.layout_description")}
        actions={
          <PillButton onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? t("storeadmin.catalog.hide_history") : t("storeadmin.catalog.history")}
          </PillButton>
        }
      />

      {/* Added beside the list, nothing removed. Twenty-four sections fit on a
          screen today; they will not always. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("storeadmin.catalog.search_sections_placeholder")}
          aria-label={t("storeadmin.catalog.search_sections")}
          className="h-8 w-60 rounded-md border border-border bg-transparent px-2 text-sm"
        />
        {(["all", "on", "off"] as const).map((v) => (
          <PillButton
            key={v}
            variant={only === v ? "primary" : "ghost"}
            onClick={() => setOnly(v)}
          >
            {v === "all" ? t("storeadmin.catalog.filter_all") : v === "on" ? t("storeadmin.catalog.filter_on") : t("storeadmin.catalog.filter_off")}
          </PillButton>
        ))}
        <span className="text-xs text-muted-foreground">
          {t("storeadmin.catalog.sections_shown", { shown: shown.length, total: data.length })}
        </span>
      </div>

      {showHistory ? <LayoutHistoryPanel onRestored={() => invalidate()} /> : null}
      {isError ? (
        <LoadFailure error={error} what={t("storeadmin.catalog.what_sections")} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> {t("storeadmin.catalog.loading")}</div>
      ) : (
        <div className="grid gap-2">
          {shown.map((s) => {
            // The position and the arrows are about where this section sits in
            // the whole layout, not where it sits in a filtered view. Using the
            // filtered index would number a search result #1 and move the wrong
            // row when the list is narrowed.
            const i = data.findIndex((d) => d.id === s.id);
            return (
            <div key={s.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-muted-foreground w-8">#{i + 1}</div>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">{t("storeadmin.catalog.key_label")} {s.key}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {CONFIGURED_BY[s.key] && onNavigate ? (
                  <button
                    onClick={() => onNavigate(CONFIGURED_BY[s.key]!)}
                    title={t("storeadmin.catalog.configure_title", { screen: CONFIGURED_BY[s.key] })}
                    className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {t("storeadmin.catalog.configure")}
                  </button>
                ) : null}
                <button onClick={() => move(i, -1)} className="rounded border border-border px-2 py-1 text-xs">↑</button>
                <button onClick={() => move(i, 1)} className="rounded border border-border px-2 py-1 text-xs">↓</button>
                <button
                  onClick={() => toggleMut.mutate({ key: s.key, enabled: !s.enabled })}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${s.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}`}
                >
                  {s.enabled ? t("storeadmin.catalog.on") : t("storeadmin.catalog.off")}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- shared bits ---------------- */

const inp = "w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (x: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onChange(!v)}
      className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs ${v ? "bg-emerald-500/10 text-emerald-300" : "bg-background/40 text-muted-foreground"}`}
    >
      <span>{label}</span><span className="font-bold">{v ? t("storeadmin.catalog.on") : t("storeadmin.catalog.off")}</span>
    </button>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold">{children}</th>;
}
function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">{children}</span>;
}
function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
      {children}
    </button>
  );
}
