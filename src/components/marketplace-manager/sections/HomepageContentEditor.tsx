// DB-backed homepage layout editor: homepage_sections order/visibility + feature_strip_items.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronUp, ChevronDown, Eye, EyeOff, Loader2, Plus, Trash2, Save, Layers, Sparkles,
} from "lucide-react";
import { Card, PillButton, StatCard } from "../ui";
import {
  fetchHomepageSections, updateHomepageSection, reorderHomepageSectionRows,
  fetchFeatureStripItems, updateFeatureStripItem, createFeatureStripItem,
  deleteFeatureStripItem, reorderFeatureStripItems,
  type FeatureStripItem, type HomepageSection,
} from "@/lib/homepage-content";
import { iconFromName, HERO_ICON_CHOICES } from "@/lib/hero-slides";

const COLORS = [
  "text-emerald-300", "text-cyan-300", "text-amber-300", "text-rose-300",
  "text-violet-300", "text-sky-300", "text-fuchsia-300",
];

export function HomepageContentEditor() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["homepage_sections"] });
    qc.invalidateQueries({ queryKey: ["feature_strip_items"] });
  };

  const sectionsQ = useQuery({ queryKey: ["homepage_sections"], queryFn: fetchHomepageSections });
  const stripQ = useQuery({ queryKey: ["feature_strip_items"], queryFn: fetchFeatureStripItems });

  const sections = sectionsQ.data ?? [];
  const strip = stripQ.data ?? [];

  const secUpdate = useMutation({
    mutationFn: (v: { id: string; patch: Partial<HomepageSection> }) => updateHomepageSection(v.id, v.patch),
    onSuccess: () => { invalidate(); toast.success("Section updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const secReorder = useMutation({
    mutationFn: reorderHomepageSectionRows,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const stripUpdate = useMutation({
    mutationFn: (v: { id: string; patch: Partial<FeatureStripItem> }) => updateFeatureStripItem(v.id, v.patch),
    onSuccess: () => { invalidate(); toast.success("Badge updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const stripCreate = useMutation({
    mutationFn: createFeatureStripItem,
    onSuccess: () => { invalidate(); toast.success("Badge added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const stripDelete = useMutation({
    mutationFn: deleteFeatureStripItem,
    onSuccess: () => { invalidate(); toast.success("Badge removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const stripReorder = useMutation({
    mutationFn: reorderFeatureStripItems,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const move = <T extends { id: string }>(rows: T[], id: string, dir: -1 | 1, run: (ids: string[]) => void) => {
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(ids);
  };

  const loading = sectionsQ.isLoading || stripQ.isLoading;

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Live Sections" value={String(sections.filter((s) => s.visible).length)} tone="success" />
        <StatCard label="Hidden Sections" value={String(sections.filter((s) => !s.visible).length)} />
        <StatCard label="Strip Badges" value={String(strip.length)} tone="premium" />
        <StatCard label="Visible Badges" value={String(strip.filter((s) => s.visible).length)} tone="success" />
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading homepage layout…
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Homepage sections */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-bold">
                <Layers className="h-4 w-4 text-accent" /> Homepage Sections
              </div>
              <span className="text-[11px] text-muted-foreground">{sections.length} live-connected rows</span>
            </div>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2.5">
                  <div className="flex flex-col">
                    <button
                      disabled={i === 0}
                      onClick={() => move(sections, s.id, -1, secReorder.mutate)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label="Move up"
                    ><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button
                      disabled={i === sections.length - 1}
                      onClick={() => move(sections, s.id, 1, secReorder.mutate)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label="Move down"
                    ><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-border bg-background/50 font-mono text-[11px] font-bold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={s.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        qc.setQueryData<HomepageSection[]>(["homepage_sections"], (old) =>
                          (old ?? []).map((r) => (r.id === s.id ? { ...r, label } : r)));
                      }}
                      onBlur={(e) => secUpdate.mutate({ id: s.id, patch: { label: e.target.value } })}
                      className="w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-bold outline-none focus:border-border focus:bg-background"
                    />
                    <div className="px-1 font-mono text-[10px] text-muted-foreground">{s.section_key}</div>
                  </div>
                  <button
                    onClick={() => secUpdate.mutate({ id: s.id, patch: { visible: !s.visible } })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      s.visible ? "border-success/40 bg-success/10 text-success" : "border-border bg-white/[0.04] text-muted-foreground"
                    }`}
                  >
                    {s.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {s.visible ? "Visible" : "Hidden"}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Feature strip */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-accent" /> Feature Strip
              </div>
              <PillButton
                variant="primary"
                onClick={() => stripCreate.mutate({ position: strip.length })}
              >
                <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add badge</span>
              </PillButton>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-background/30 p-3">
              {strip.filter((s) => s.visible).map((s) => {
                const I = iconFromName(s.icon_name);
                return (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] font-semibold">
                    <I className={`h-3.5 w-3.5 ${s.color_class}`} /> {s.label}
                  </span>
                );
              })}
              {strip.filter((s) => s.visible).length === 0 && (
                <span className="text-[11px] text-muted-foreground">No visible badges — the strip is hidden.</span>
              )}
            </div>

            <div className="space-y-2">
              {strip.map((s, i) => (
                <StripRow
                  key={s.id}
                  item={s}
                  first={i === 0}
                  last={i === strip.length - 1}
                  onMove={(dir) => move(strip, s.id, dir, stripReorder.mutate)}
                  onSave={(patch) => stripUpdate.mutate({ id: s.id, patch })}
                  onDelete={() => stripDelete.mutate(s.id)}
                />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StripRow({
  item, first, last, onMove, onSave, onDelete,
}: {
  item: FeatureStripItem;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (patch: Partial<FeatureStripItem>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [icon, setIcon] = useState(item.icon_name);
  const [color, setColor] = useState(item.color_class);
  const dirty = label !== item.label || icon !== item.icon_name || color !== item.color_class;
  const Icon = iconFromName(icon);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 p-2.5">
      <div className="flex flex-col">
        <button disabled={first} onClick={() => onMove(-1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button disabled={last} onClick={() => onMove(1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
      </div>
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/50">
        <Icon className={`h-4 w-4 ${color}`} />
      </span>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-[8rem] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-primary"
      />
      <select value={icon} onChange={(e) => setIcon(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px]">
        {HERO_ICON_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={color} onChange={(e) => setColor(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px]">
        {COLORS.map((c) => <option key={c} value={c}>{c.replace("text-", "").replace("-300", "")}</option>)}
      </select>
      <button
        onClick={() => onSave({ visible: !item.visible })}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
          item.visible ? "border-success/40 bg-success/10 text-success" : "border-border bg-white/[0.04] text-muted-foreground"
        }`}
      >
        {item.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
      {dirty && (
        <button
          onClick={() => onSave({ label, icon_name: icon, color_class: color })}
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      )}
      <button onClick={onDelete} className="rounded-md p-1 text-destructive hover:bg-destructive/10" aria-label="Delete badge">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
