import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Inbox, Plus, Search } from "lucide-react";
import { RESELLER_CENTERS, type CenterKey, type CenterFeature } from "@/lib/reseller-extras";

export function ResellerCenterPage({
  centerKey,
  onBack,
}: {
  centerKey: CenterKey;
  onBack: () => void;
}) {
  const cfg = RESELLER_CENTERS[centerKey];
  const Icon = cfg.icon;
  const allFeatures = cfg.sections.flatMap((s) => s.features);
  const [active, setActive] = useState<CenterFeature | null>(null);
  const [q, setQ] = useState("");

  const filtered = (features: CenterFeature[]) =>
    !q ? features : features.filter((f) => (f.label + f.description).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => (active ? setActive(null) : onBack())}
          className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-glow"
            style={{ background: cfg.gradient }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Reseller</div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              {active ? active.label : cfg.title}
            </h1>
          </div>
        </div>
        {!active && (
          <div className="ml-auto relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this center…"
              className="rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring w-56 md:w-72"
            />
          </div>
        )}
      </div>

      {active ? (
        <FeatureDetail feature={active} accent={cfg.accent} />
      ) : (
        <>
          {/* Banner card */}
          <section
            className="relative overflow-hidden rounded-3xl border border-border p-6 md:p-8 text-white shadow-card"
            style={{ background: cfg.gradient }}
          >
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                background: `radial-gradient(560px 240px at 90% 10%, color-mix(in oklab, ${cfg.accent} 40%, transparent), transparent)`,
              }}
            />
            <div className="relative max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">{cfg.label}</div>
              <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">{cfg.title}</h2>
              <p className="mt-2 text-sm md:text-base text-white/75">{cfg.tagline}</p>
              <div className="mt-5 flex items-center gap-3 text-[11px] text-white/70">
                <span className="rounded-full bg-white/10 px-2.5 py-1 border border-white/15">
                  {allFeatures.length} features
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 border border-white/15">
                  {cfg.sections.length} sections
                </span>
              </div>
            </div>
          </section>

          {/* Sections of cards */}
          {cfg.sections.map((sec) => {
            const items = filtered(sec.features);
            if (items.length === 0) return null;
            return (
              <section key={sec.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {sec.label}
                  </div>
                  <div className="h-px flex-1 bg-border" />
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((f) => (
                    <FeatureCard key={f.key} feature={f} onOpen={() => setActive(f)} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function FeatureCard({ feature, onOpen }: { feature: CenterFeature; onOpen: () => void }) {
  const Icon = feature.icon;
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-2xl bg-card border border-border p-4 shadow-card hover:border-brand/50 hover:bg-surface/40 transition relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/10 blur-2xl opacity-0 group-hover:opacity-100 transition" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface border border-border text-foreground/80 group-hover:text-brand-foreground group-hover:bg-gradient-brand group-hover:border-transparent transition">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-sm truncate">{feature.label}</div>
            {feature.badge && (
              <span className="text-[9px] uppercase tracking-wider rounded-full bg-warning/15 text-warning px-2 py-0.5">
                {feature.badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{feature.description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

function FeatureDetail({ feature, accent }: { feature: CenterFeature; accent: string }) {
  const Icon = feature.icon;
  const [configOpen, setConfigOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
      <div className="p-6 md:p-8 border-b border-border grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="flex min-w-0 items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: accent }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold tracking-tight">{feature.label}</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">{feature.description}</p>
        </div>
        </div>
        <button
          type="button"
          onClick={() => setConfigOpen((v) => !v)}
          aria-expanded={configOpen}
          className="press-3d shrink-0 inline-flex items-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" /> {configOpen ? "Close" : "Configure"}
        </button>
      </div>

      {configOpen && (
        <form
          className="animate-fade-in border-b border-border p-6 md:p-8 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              localStorage.setItem(
                `sv.center.${feature.key}`,
                JSON.stringify({ endpoint: fd.get("endpoint"), owner: fd.get("owner") }),
              );
              toast.success(`${feature.label} settings saved`);
            } catch {
              toast.error("Could not save settings locally");
            }
            setConfigOpen(false);
          }}
        >
          <label className="text-xs space-y-1.5">
            <span className="text-muted-foreground">API endpoint</span>
            <input
              name="endpoint"
              placeholder="https://api.yourdomain.com/reseller/…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-xs space-y-1.5">
            <span className="text-muted-foreground">Owner</span>
            <input
              name="owner"
              placeholder="Team or person responsible"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="press-3d rounded-lg bg-brand text-brand-foreground px-3 py-2 text-xs font-semibold">Save</button>
            <button type="button" onClick={() => setConfigOpen(false)} className="press-3d rounded-lg border border-border px-3 py-2 text-xs">Cancel</button>
          </div>
        </form>
      )}

      <div className="p-8 md:p-12 grid place-items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <div className="mt-4 text-base font-semibold">No records yet</div>
        <div className="text-xs text-muted-foreground mt-1 max-w-md">
          This screen is ready to be wired to your existing Reseller API endpoint.
          When connected, real records will appear here in real time — nothing is faked.
        </div>
      </div>
    </div>
  );
}
