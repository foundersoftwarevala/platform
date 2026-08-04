// Fully DB-backed Hero Slides Manager — CRUD, publish/draft/schedule, reorder, preview, audit.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Calendar, Eye, Edit3, Trash2, ChevronUp, ChevronDown, Save, X,
  CheckCircle2, Clock, FileText, Archive, Power, Loader2, ArrowRight,
} from "lucide-react";
import { Card, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import {
  fetchAllHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
  reorderHeroSlides, isSlideLive, iconFromName, HERO_ICON_CHOICES,
  type HeroSlideRow, type HeroStatus,
} from "@/lib/hero-slides";

const STATUS_TABS = ["All", "Live", "Scheduled", "Drafts", "Archived"] as const;
type Tab = (typeof STATUS_TABS)[number];

const GRADIENT_PRESETS = [
  { name: "Cyan",     value: "from-[oklch(0.14_0.07_260)] via-[oklch(0.18_0.07_262)] to-[oklch(0.24_0.08_265)]", accent: "text-cyan-300",    ring: "border-cyan-400/40",    badge: "bg-cyan-500/15 text-cyan-200" },
  { name: "Amber",    value: "from-[oklch(0.16_0.08_60)] via-[oklch(0.2_0.09_50)] to-[oklch(0.26_0.11_40)]",   accent: "text-amber-300",   ring: "border-amber-400/40",   badge: "bg-amber-500/15 text-amber-200" },
  { name: "Emerald",  value: "from-[oklch(0.14_0.08_170)] via-[oklch(0.18_0.09_165)] to-[oklch(0.24_0.1_160)]", accent: "text-emerald-300", ring: "border-emerald-400/40", badge: "bg-emerald-500/15 text-emerald-200" },
  { name: "Sky",      value: "from-[oklch(0.14_0.07_240)] via-[oklch(0.18_0.07_230)] to-[oklch(0.24_0.08_220)]", accent: "text-sky-300",     ring: "border-sky-400/40",     badge: "bg-sky-500/15 text-sky-200" },
  { name: "Violet",   value: "from-[oklch(0.16_0.09_300)] via-[oklch(0.2_0.1_295)] to-[oklch(0.26_0.12_290)]",  accent: "text-violet-300",  ring: "border-violet-400/40",  badge: "bg-violet-500/15 text-violet-200" },
  { name: "Rose",     value: "from-[oklch(0.16_0.1_15)] via-[oklch(0.2_0.11_10)] to-[oklch(0.26_0.13_5)]",     accent: "text-rose-300",    ring: "border-rose-400/40",    badge: "bg-rose-500/15 text-rose-200" },
  { name: "Fuchsia",  value: "from-[oklch(0.16_0.1_330)] via-[oklch(0.2_0.11_320)] to-[oklch(0.26_0.13_310)]", accent: "text-fuchsia-300", ring: "border-fuchsia-400/40", badge: "bg-fuchsia-500/15 text-fuchsia-200" },
];

const EMPTY: Partial<HeroSlideRow> = {
  kicker: "", headline: "", sub: "", cta_label: "Learn more", cta_href: "/marketplace",
  secondary_label: "", secondary_href: "",
  icon: "Sparkles",
  bg_gradient: GRADIENT_PRESETS[0].value,
  accent_class: GRADIENT_PRESETS[0].accent,
  ring_class: GRADIENT_PRESETS[0].ring,
  badge_class: GRADIENT_PRESETS[0].badge,
  status: "draft" as HeroStatus,
  enabled: true, sort_order: 999,
  publish_at: null, unpublish_at: null,
  visible_roles: [], visible_countries: [], visible_languages: [],
};

export function HeroBannerSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("All");
  const [editing, setEditing] = useState<HeroSlideRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["hero_slides", "all"],
    queryFn: fetchAllHeroSlides,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hero_slides"] });
  };

  const createMut = useMutation({
    mutationFn: createHeroSlide,
    onSuccess: () => { invalidate(); toast.success("Slide created"); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; patch: Partial<HeroSlideRow> }) => updateHeroSlide(v.id, v.patch),
    onSuccess: () => { invalidate(); toast.success("Slide updated"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteHeroSlide,
    onSuccess: () => { invalidate(); toast.success("Slide deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reorderMut = useMutation({
    mutationFn: reorderHeroSlides,
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const now = new Date();
    return slides.filter((s) => {
      if (tab === "All") return true;
      if (tab === "Live") return isSlideLive(s, now);
      if (tab === "Scheduled") return s.status === "scheduled" || (s.status === "published" && s.publish_at && new Date(s.publish_at) > now);
      if (tab === "Drafts") return s.status === "draft";
      if (tab === "Archived") return s.status === "archived";
      return true;
    });
  }, [slides, tab]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: slides.length,
      live: slides.filter((s) => isSlideLive(s, now)).length,
      scheduled: slides.filter((s) => s.status === "scheduled" || (s.status === "published" && s.publish_at && new Date(s.publish_at) > now)).length,
      drafts: slides.filter((s) => s.status === "draft").length,
    };
  }, [slides]);

  const move = (id: string, dir: -1 | 1) => {
    const ids = slides.map((s) => s.id);
    const idx = ids.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderMut.mutate(ids);
  };

  const setStatus = (s: HeroSlideRow, status: HeroStatus) =>
    updateMut.mutate({ id: s.id, patch: { status } });

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={`Hero Banner Manager · ${slides.length} slides`}
        title="Hero Banner Manager"
        description="Live-connected cinematic hero slides. Create, edit, schedule, and reorder — changes appear on the home page instantly."
        actions={
          <>
            <a href="/" target="_blank" rel="noreferrer">
              <PillButton variant="ghost">
                <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Preview Home</span>
              </PillButton>
            </a>
            <PillButton variant="primary" onClick={() => setCreating(true)}>
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Slide</span>
            </PillButton>
          </>
        }
      />
      <SubNav items={STATUS_TABS as unknown as string[]} active={tab} onChange={(v) => setTab(v as Tab)} />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(stats.total)} icon={<FileText className="h-3.5 w-3.5" />} />
        <StatCard label="Live" value={String(stats.live)} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <StatCard label="Scheduled" value={String(stats.scheduled)} tone="warning" icon={<Clock className="h-3.5 w-3.5" />} />
        <StatCard label="Drafts" value={String(stats.drafts)} icon={<Edit3 className="h-3.5 w-3.5" />} />
      </div>

      {isLoading ? (
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading slides…</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="py-8 text-center text-sm text-muted-foreground">No slides in this view. Click <b>New Slide</b> to create one.</div></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((s, i) => (
            <SlideCard
              key={s.id}
              slide={s}
              onEdit={() => setEditing(s)}
              onDelete={() => { if (confirm(`Delete "${s.headline}"?`)) deleteMut.mutate(s.id); }}
              onMoveUp={i > 0 ? () => move(s.id, -1) : undefined}
              onMoveDown={i < filtered.length - 1 ? () => move(s.id, 1) : undefined}
              onPublish={() => setStatus(s, "published")}
              onDraft={() => setStatus(s, "draft")}
              onArchive={() => setStatus(s, "archived")}
              onToggle={() => updateMut.mutate({ id: s.id, patch: { enabled: !s.enabled } })}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SlideEditor
          initial={editing ?? (EMPTY as HeroSlideRow)}
          isNew={creating}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(v) => {
            if (creating) createMut.mutate(v as HeroSlideRow);
            else if (editing) updateMut.mutate({ id: editing.id, patch: v });
          }}
          busy={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function StatusPill({ s }: { s: HeroSlideRow }) {
  const live = isSlideLive(s);
  if (!s.enabled) return <span className="rounded bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Disabled</span>;
  if (s.status === "archived") return <span className="rounded bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Archived</span>;
  if (s.status === "draft") return <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent backdrop-blur">Draft</span>;
  if (live) return <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success backdrop-blur">Live</span>;
  return <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning backdrop-blur">Scheduled</span>;
}

function SlideCard({
  slide, onEdit, onDelete, onMoveUp, onMoveDown, onPublish, onDraft, onArchive, onToggle,
}: {
  slide: HeroSlideRow;
  onEdit: () => void; onDelete: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  onPublish: () => void; onDraft: () => void; onArchive: () => void; onToggle: () => void;
}) {
  const Icon = iconFromName(slide.icon ?? "Sparkles");
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className={`relative h-40 bg-gradient-to-br ${slide.bg_gradient}`}>
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <StatusPill s={slide} />
          <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80 backdrop-blur">#{slide.sort_order}</span>
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/40 backdrop-blur disabled:opacity-30" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/40 backdrop-blur disabled:opacity-30" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-end gap-3">
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${slide.badge_class}`}>
            <Icon className={`h-5 w-5 ${slide.accent_class}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] uppercase tracking-wider text-white/70">{slide.kicker}</div>
            <div className="truncate text-base font-bold text-white">{slide.headline}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ArrowRight className="h-3.5 w-3.5" /> {slide.cta_label}</span>
          {slide.publish_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(slide.publish_at).toLocaleDateString()}</span>}
        </div>
        <div className="flex items-center gap-1">
          <IconBtn title={slide.enabled ? "Disable" : "Enable"} onClick={onToggle}><Power className={`h-3.5 w-3.5 ${slide.enabled ? "text-success" : "text-muted-foreground"}`} /></IconBtn>
          {slide.status !== "published" && <IconBtn title="Publish" onClick={onPublish}><CheckCircle2 className="h-3.5 w-3.5 text-success" /></IconBtn>}
          {slide.status !== "draft" && <IconBtn title="Move to draft" onClick={onDraft}><FileText className="h-3.5 w-3.5" /></IconBtn>}
          {slide.status !== "archived" && <IconBtn title="Archive" onClick={onArchive}><Archive className="h-3.5 w-3.5" /></IconBtn>}
          <IconBtn title="Edit" onClick={onEdit}><Edit3 className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn title="Delete" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/40 hover:bg-background/70">
      {children}
    </button>
  );
}

function SlideEditor({
  initial, isNew, onClose, onSave, busy,
}: {
  initial: HeroSlideRow;
  isNew: boolean;
  onClose: () => void;
  onSave: (v: Partial<HeroSlideRow>) => void;
  busy: boolean;
}) {
  const [f, setF] = useState<Partial<HeroSlideRow>>(initial);
  const set = <K extends keyof HeroSlideRow>(k: K, v: HeroSlideRow[K] | null | undefined) =>
    setF((prev: Partial<HeroSlideRow>) => ({ ...prev, [k]: v as HeroSlideRow[K] }));
  const applyPreset = (p: typeof GRADIENT_PRESETS[number]) => {
    setF((prev: Partial<HeroSlideRow>) => ({ ...prev, bg_gradient: p.value, accent_class: p.accent, ring_class: p.ring, badge_class: p.badge }));
  };
  const Icon = iconFromName(f.icon ?? "Sparkles");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-bold">{isNew ? "New hero slide" : "Edit hero slide"}</div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Live preview */}
        <div className={`relative h-52 bg-gradient-to-br ${f.bg_gradient}`}>
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
          <div className="absolute inset-x-6 bottom-5 flex items-end gap-4">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.badge_class}`}>
              <Icon className={`h-6 w-6 ${f.accent_class}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-semibold uppercase tracking-wider ${f.accent_class}`}>{f.kicker || "KICKER"}</div>
              <div className="truncate text-xl font-bold text-white">{f.headline || "Headline preview"}</div>
              <div className="truncate text-sm text-white/70">{f.sub || "Sub headline preview"}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Kicker"><Input value={f.kicker ?? ""} onChange={(v) => set("kicker", v)} /></Field>
          <Field label="Icon">
            <select value={f.icon ?? "Sparkles"} onChange={(e) => set("icon", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {HERO_ICON_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Headline" full><Input value={f.headline ?? ""} onChange={(v) => set("headline", v)} /></Field>
          <Field label="Sub headline" full><Input value={f.sub ?? ""} onChange={(v) => set("sub", v)} /></Field>

          <Field label="CTA label"><Input value={f.cta_label ?? ""} onChange={(v) => set("cta_label", v)} /></Field>
          <Field label="CTA link"><Input value={f.cta_href ?? ""} onChange={(v) => set("cta_href", v)} /></Field>
          <Field label="Secondary label"><Input value={f.secondary_label ?? ""} onChange={(v) => set("secondary_label", v || null)} /></Field>
          <Field label="Secondary link"><Input value={f.secondary_href ?? ""} onChange={(v) => set("secondary_href", v || null)} /></Field>

          <Field label="Theme preset" full>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_PRESETS.map((p) => (
                <button key={p.name} onClick={() => applyPreset(p)}
                  className={`h-8 rounded-md border px-3 text-xs font-semibold bg-gradient-to-br ${p.value} ${f.bg_gradient === p.value ? "ring-2 ring-primary" : "border-border"}`}>
                  <span className={p.accent}>{p.name}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value as HeroStatus)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Sort order">
            <Input value={String(f.sort_order ?? 0)} onChange={(v) => set("sort_order", Number(v) || 0)} type="number" />
          </Field>

          <Field label="Publish at (optional)">
            <Input type="datetime-local"
              value={f.publish_at ? toLocal(f.publish_at) : ""}
              onChange={(v) => set("publish_at", v ? new Date(v).toISOString() : null)} />
          </Field>
          <Field label="Unpublish at (optional)">
            <Input type="datetime-local"
              value={f.unpublish_at ? toLocal(f.unpublish_at) : ""}
              onChange={(v) => set("unpublish_at", v ? new Date(v).toISOString() : null)} />
          </Field>

          <Field label="Visible roles (comma-separated, blank = all)" full>
            <Input value={(f.visible_roles ?? []).join(",")} onChange={(v) => set("visible_roles", v.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="Visible countries (ISO, blank = all)">
            <Input value={(f.visible_countries ?? []).join(",")} onChange={(v) => set("visible_countries", v.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="Visible languages (blank = all)">
            <Input value={(f.visible_languages ?? []).join(",")} onChange={(v) => set("visible_languages", v.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={!!f.enabled} onChange={(e) => set("enabled", e.target.checked)} />
            Enabled (master on/off)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <PillButton variant="ghost" onClick={onClose}>Cancel</PillButton>
          <PillButton variant="primary" onClick={() => {
            if (!f.headline?.trim()) { toast.error("Headline is required"); return; }
            const { id, created_at, updated_at, created_by, updated_by, ...rest } = f as HeroSlideRow;
            void id; void created_at; void updated_at; void created_by; void updated_by;
            onSave(rest);
          }}>
            <span className="inline-flex items-center gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isNew ? "Create slide" : "Save changes"}
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
  );
}
function toLocal(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
