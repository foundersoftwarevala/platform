import { useMemo, useState } from "react";
import { Download, Expand, Search, X } from "lucide-react";
import { Collectible3D } from "./Collectible3D";
import { SVMicroMark, SVSeal, svCollectionNumber } from "@/components/ams/brand/SVMark";
import { TIERS, TROPHIES, ROLE_LIST, type Tier, type TrophyStage } from "@/lib/ams/trophy-catalog";
import { stageRender, referenceForRole } from "@/lib/ams/trophy-stage-assets";
import { getRole } from "@/lib/ams/roles";

const TIER_HUE: Record<Tier, string> = {
  Foundation: "#7dd3fc",
  Advance: "#a78bfa",
  Elite: "#f0abfc",
  Legacy: "#facc15",
};

function accentFor(slug: string, tier: Tier) {
  return getRole(slug)?.accent ?? TIER_HUE[tier];
}

const chip =
  "rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest transition-colors";

export function TrophyStageGallery() {
  const [role, setRole] = useState<string>("all");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<TrophyStage | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TROPHIES.filter(
      (t) =>
        (role === "all" || t.roleSlug === role) &&
        (tier === "all" || t.tier === tier) &&
        (!q || t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q)),
    );
  }, [role, tier, query]);

  const activeAccent = active ? accentFor(active.roleSlug, active.tier) : "#facc15";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={chip}
          style={
            role === "all"
              ? { borderColor: "#facc15", color: "#facc15", background: "#facc1512" }
              : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
          }
          onClick={() => setRole("all")}
        >
          All roles
        </button>
        {ROLE_LIST.map((r) => {
          const on = role === r.slug;
          const hue = accentFor(r.slug, "Legacy");
          return (
            <button
              key={r.slug}
              className={chip}
              style={
                on
                  ? { borderColor: hue, color: hue, background: `${hue}12` }
                  : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
              onClick={() => setRole(r.slug)}
            >
              {r.role}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...TIERS] as const).map((t) => {
            const on = tier === t;
            const hue = t === "all" ? "#facc15" : TIER_HUE[t];
            return (
              <button
                key={t}
                className={chip}
                style={
                  on
                    ? { borderColor: hue, color: hue, background: `${hue}12` }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
                onClick={() => setTier(t as Tier | "all")}
              >
                {t === "all" ? "All tiers" : t}
              </button>
            );
          })}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stage or role"
            className="h-9 w-60 rounded-lg border border-border/70 bg-black/20 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-amber-400/60"
          />
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        {visible.length} of {TROPHIES.length} stages shown
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {visible.map((item) => {
          const src = stageRender(item.id);
          const accent = accentFor(item.roleSlug, item.tier);
          return (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border bg-black/25"
              style={{ borderColor: `${accent}44` }}
            >
              <div
                className="relative aspect-square overflow-hidden"
                style={{
                  background: `radial-gradient(120% 70% at 50% 0%, ${accent}1f, transparent 62%), linear-gradient(180deg,#05070d,#0a0f1a)`,
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt={`${item.role} stage ${item.stage} trophy — ${item.name}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">
                    render pending
                  </div>
                )}

                {/* Software Vala brand identity on every trophy */}
                <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                  <SVSeal accent={accent} size={22} />
                  <SVMicroMark accent={accent} className="hidden sm:inline" />
                </div>
                <div
                  className="absolute bottom-2 right-3 z-10 font-mono uppercase"
                  style={{ fontSize: 9, letterSpacing: "0.22em", color: `${accent}aa` }}
                >
                  {svCollectionNumber(item.id, item.roleSlug.slice(0, 3))}
                </div>

                <div className="absolute right-3 top-3 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    aria-label="Inspect in 3D"
                    className="rounded-md border bg-black/50 p-1.5 text-white/90 backdrop-blur transition hover:bg-black/70"
                    style={{ borderColor: `${accent}66` }}
                  >
                    <Expand className="h-3.5 w-3.5" />
                  </button>
                  {src && (
                    <a
                      href={src}
                      download={`${item.id}.png`}
                      aria-label="Download PNG"
                      className="rounded-md border bg-black/50 p-1.5 text-white/90 backdrop-blur transition hover:bg-black/70"
                      style={{ borderColor: `${accent}66` }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-1 p-4">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em]">
                  <span style={{ color: `${accent}bb` }}>
                    {item.role} · Stage {String(item.stage).padStart(2, "0")}
                  </span>
                  <span style={{ color: TIER_HUE[item.tier] }}>{item.tier}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{item.name}</div>
              </div>
            </article>
          );
        })}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${active.role} stage ${active.stage}`}
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-[#05070d]"
            style={{ borderColor: `${activeAccent}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/50 p-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.25em]" style={{ color: `${activeAccent}bb` }}>
                  {active.role} · Stage {String(active.stage).padStart(2, "0")} · {active.tier}
                </div>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{active.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close"
                className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {stageRender(active.id) && (
                <Collectible3D
                  eager
                  src={stageRender(active.id)!}
                  filename={`${active.id}.png`}
                  accent={activeAccent}
                  label={`${active.role} · ${active.tier}`}
                  height={380}
                  showUnlock
                  unlockKind="trophy"
                  unlockTitle={`${active.name} Unlocked`}
                  unlockSubtitle={`${active.role} · Stage ${active.stage}`}
                />
              )}
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{active.brief}</p>
              {referenceForRole(active.roleSlug) && (
                <div className="mt-4 flex items-center gap-3">
                  <img
                    src={referenceForRole(active.roleSlug)!.src}
                    alt={`${active.role} studio reference`}
                    loading="lazy"
                    className="h-16 w-16 rounded-lg border border-border/60 object-cover"
                  />
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Studio reference · {active.role}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
