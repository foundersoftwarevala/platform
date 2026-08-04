// DB-backed catalog admin used by ProductsSection & CategoriesSection.
// Reads/writes through server functions in @/lib/marketplace.functions.
import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/marketplace-manager/localFn";
import { toast } from "sonner";
import { Plus, Save, Trash2, X, Loader2, Edit3, Eye, EyeOff } from "lucide-react";
import {
  listProductsAdmin, upsertProduct, deleteProduct,
  listCategoriesAdmin, upsertCategory, deleteCategory,
  listSectionsAdmin, setSectionEnabled, reorderSections,
} from "@/lib/marketplace-manager/catalog";
import { Card, PageHeader, PillButton } from "../ui";

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
  const qc = useQueryClient();
  const listFn = useServerFn(listProductsAdmin);
  const upsertFn = useServerFn(upsertProduct);
  const deleteFn = useServerFn(deleteProduct);

  const { data = [], isLoading } = useQuery<Product[]>({
    queryKey: ["mp_products_admin"], queryFn: async () => (await listFn()) as unknown as Product[],
  });

  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: Partial<Product>) => upsertFn({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_products_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Product saved");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_products_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Product deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Management · Marketplace"
        title="Products"
        description="Add, edit and flag products; changes appear on the public marketplace homepage instantly."
        actions={
          <PillButton variant="primary" onClick={() => setEditing({ ...EMPTY_PRODUCT })}>
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Product</span>
          </PillButton>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : data.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground">No products yet. Create your first product — it will appear on the marketplace homepage automatically.</div></Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Name</Th><Th>Slug</Th><Th>Price</Th><Th>Badge</Th>
                <Th>Flags</Th><Th>Visible</Th><Th>Order</Th><Th>Actions</Th>
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
                      {p.is_featured && <Chip>Featured</Chip>}
                      {p.is_trending && <Chip>Trending</Chip>}
                      {p.is_best_seller && <Chip>Best</Chip>}
                      {p.is_new_release && <Chip>New</Chip>}
                      {p.is_ai && <Chip>AI</Chip>}
                    </div>
                  </Td>
                  <Td>{p.visible ? <Eye className="h-4 w-4 text-emerald-400"/> : <EyeOff className="h-4 w-4 text-muted-foreground"/>}</Td>
                  <Td>{p.sort_order}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <IconBtn onClick={() => setEditing(p)} label="Edit"><Edit3 className="h-3.5 w-3.5"/></IconBtn>
                      <IconBtn onClick={() => { if (confirm(`Delete ${p.name}?`)) delMut.mutate(p.id); }} label="Delete"><Trash2 className="h-3.5 w-3.5"/></IconBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  const [v, setV] = useState<Partial<Product>>(value);
  const set = <K extends keyof Product>(k: K, val: Product[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{v.id ? "Edit Product" : "New Product"}</h3>
          <button onClick={onCancel}><X className="h-4 w-4"/></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inp} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Slug"><input className={inp} value={v.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></Field>
          <Field label="Industry label"><input className={inp} value={v.industry_label ?? ""} onChange={(e) => set("industry_label", e.target.value)} /></Field>
          <Field label="Icon (lucide name)"><input className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} /></Field>
          <Field label="Price label"><input className={inp} value={v.price_label ?? ""} onChange={(e) => set("price_label", e.target.value)} placeholder="₹4,999 or Contact"/></Field>
          <Field label="Price period"><input className={inp} value={v.price_period ?? ""} onChange={(e) => set("price_period", e.target.value)} placeholder="month / year"/></Field>
          <Field label="Rating (0-5)"><input type="number" step="0.1" className={inp} value={v.rating ?? 0} onChange={(e) => set("rating", Number(e.target.value))} /></Field>
          <Field label="Downloads"><input type="number" className={inp} value={v.downloads ?? 0} onChange={(e) => set("downloads", Number(e.target.value))} /></Field>
          <Field label="Downloads label"><input className={inp} value={v.downloads_label ?? ""} onChange={(e) => set("downloads_label", e.target.value)} placeholder="12k+"/></Field>
          <Field label="Badge">
            <select className={inp} value={v.badge ?? ""} onChange={(e) => set("badge", (e.target.value || null) as any)}>
              <option value="">None</option><option>NEW</option><option>HOT</option><option>TOP</option><option>DEAL</option>
            </select>
          </Field>
          <Field label="Sort order"><input type="number" className={inp} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Toggle label="Visible" v={!!v.visible} onChange={(x) => set("visible", x)} />
          <Toggle label="Featured" v={!!v.is_featured} onChange={(x) => set("is_featured", x)} />
          <Toggle label="Trending" v={!!v.is_trending} onChange={(x) => set("is_trending", x)} />
          <Toggle label="Best seller" v={!!v.is_best_seller} onChange={(x) => set("is_best_seller", x)} />
          <Toggle label="New release" v={!!v.is_new_release} onChange={(x) => set("is_new_release", x)} />
          <Toggle label="AI product" v={!!v.is_ai} onChange={(x) => set("is_ai", x)} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onCancel}>Cancel</PillButton>
          <PillButton variant="primary" onClick={() => onSave(v)}>
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} Save
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
  const qc = useQueryClient();
  const listFn = useServerFn(listCategoriesAdmin);
  const upsertFn = useServerFn(upsertCategory);
  const deleteFn = useServerFn(deleteCategory);

  const { data = [], isLoading } = useQuery<Category[]>({
    queryKey: ["mp_categories_admin"], queryFn: async () => (await listFn()) as unknown as Category[],
  });

  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: Partial<Category>) => upsertFn({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_categories_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Category saved"); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mp_categories_admin"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Category Manager"
        title="Categories"
        description="Industries and product categories that power the storefront Industry Grid and Category rows."
        actions={
          <PillButton variant="primary" onClick={() => setEditing({ ...EMPTY_CAT })}>
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5"/> New Category</span>
          </PillButton>
        }
      />
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
      ) : data.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground">No categories yet. Add one — it will appear in the Industry grid on the homepage.</div></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {c.name} {c.is_hidden && <span className="text-[10px] text-warning">HIDDEN</span>}
                  {c.is_featured && <span className="rounded bg-accent/20 px-1.5 text-[10px] text-accent">FEATURED</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">/{c.slug} · rank #{c.sort_order} · tone {c.tone ?? "—"}</div>
              </div>
              <div className="flex gap-1">
                <IconBtn onClick={() => setEditing(c)} label="Edit"><Edit3 className="h-3.5 w-3.5"/></IconBtn>
                <IconBtn onClick={() => { if (confirm(`Delete ${c.name}?`)) delMut.mutate(c.id); }} label="Delete"><Trash2 className="h-3.5 w-3.5"/></IconBtn>
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
  const [v, setV] = useState<Partial<Category>>(value);
  const set = <K extends keyof Category>(k: K, val: Category[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{v.id ? "Edit Category" : "New Category"}</h3>
          <button onClick={onCancel}><X className="h-4 w-4"/></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inp} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Slug"><input className={inp} value={v.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></Field>
          <Field label="Icon (lucide name)"><input className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} /></Field>
          <Field label="Image key"><input className={inp} value={v.image_key ?? ""} onChange={(e) => set("image_key", e.target.value)} /></Field>
          <Field label="Tone">
            <select className={inp} value={v.tone ?? "primary"} onChange={(e) => set("tone", e.target.value)}>
              <option>primary</option><option>success</option><option>warning</option>
              <option>gold</option><option>magenta</option><option>destructive</option>
            </select>
          </Field>
          <Field label="Sort order"><input type="number" className={inp} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))}/></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Toggle label="Featured" v={!!v.is_featured} onChange={(x) => set("is_featured", x)} />
          <Toggle label="Hidden" v={!!v.is_hidden} onChange={(x) => set("is_hidden", x)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onCancel}>Cancel</PillButton>
          <PillButton variant="primary" onClick={() => onSave(v)}>
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} Save
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Homepage Layout Admin ---------------- */

type Section = { id: string; key: string; title: string; enabled: boolean; sort_order: number };

export function LayoutOrderAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSectionsAdmin);
  const toggleFn = useServerFn(setSectionEnabled);
  const reorderFn = useServerFn(reorderSections);

  const { data = [], isLoading } = useQuery<Section[]>({
    queryKey: ["mp_sections_admin"], queryFn: async () => (await listFn()) as unknown as Section[],
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
    onSuccess: () => { invalidate(); toast.success("Order saved"); },
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
        eyebrow="Homepage Composition"
        title="Layout Order"
        description="Enable, disable and reorder every marketplace homepage section. Live and instant."
      />
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
      ) : (
        <div className="grid gap-2">
          {data.map((s, i) => (
            <div key={s.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-muted-foreground w-8">#{i + 1}</div>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">key: {s.key}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => move(i, -1)} className="rounded border border-border px-2 py-1 text-xs">↑</button>
                <button onClick={() => move(i, 1)} className="rounded border border-border px-2 py-1 text-xs">↓</button>
                <button
                  onClick={() => toggleMut.mutate({ key: s.key, enabled: !s.enabled })}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${s.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}`}
                >
                  {s.enabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          ))}
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
  return (
    <button
      type="button"
      onClick={() => onChange(!v)}
      className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs ${v ? "bg-emerald-500/10 text-emerald-300" : "bg-background/40 text-muted-foreground"}`}
    >
      <span>{label}</span><span className="font-bold">{v ? "ON" : "OFF"}</span>
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
