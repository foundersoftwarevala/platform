import { useMemo, useState } from "react";
import { Landmark, Layers3, Sparkles } from "lucide-react";
import { MuseumFullscreen, MuseumStage } from "./MuseumStage";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";
import { ROLES, type RoleDNA } from "@/lib/ams/roles";
import { DISPLAY_MODES, ROLE_ENVIRONMENT, type DisplayMode, type ShowcaseDef } from "@/lib/ams/museum";
import { cn } from "@/lib/utils";

/**
 * MuseumShowcase — presentation shell for every premium showcase.
 * Pure UI: display modes, role immersion environments, cinematic stages.
 */
export function MuseumShowcase({ showcase }: { showcase: ShowcaseDef }) {
  const [filter, setFilter] = useState<RoleFilterValue>("all");
  const [mode, setMode] = useState<DisplayMode>("gallery");
  const [heroIndex, setHeroIndex] = useState(0);
  const [compare, setCompare] = useState<string[]>([]);
  const [fullscreenSlug, setFullscreenSlug] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? ROLES : ROLES.filter((r) => r.slug === filter)),
    [filter],
  );
  const exportItems = useMemo(
    () => visible.map((r) => ({ src: showcase.assets[r.slug], filename: `${r.slug}-${showcase.suffix}.png` })),
    [visible, showcase],
  );

  const hero = visible[Math.min(heroIndex, visible.length - 1)] ?? ROLES[0];
  const fullscreenRole = ROLES.find((r) => r.slug === fullscreenSlug) ?? null;

  const stageFor = (role: RoleDNA, height: number, chrome: "compact" | "full" = "compact") => ({
    src: showcase.assets[role.slug],
    filename: `${role.slug}-${showcase.suffix}.png`,
    accent: role.accent,
    label: `${role.passportPrefix} · ${showcase.singular}`,
    environment: ROLE_ENVIRONMENT[role.slug],
    material: showcase.material,
    height,
    chrome,
    unlockTitle: `${role.name} ${showcase.singular} Unveiled`,
    unlockSubtitle: role.motto,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/80">
            Software Vala · {showcase.kicker}
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-foreground lg:text-4xl">{showcase.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{showcase.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            {showcase.collectionStyle} · {visible.length} of {ROLES.length} on display
          </span>
          <span className="inline-flex items-center gap-2">
            <Layers3 className="h-3.5 w-3.5 text-primary/70" /> {showcase.material}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={(v) => { setFilter(v); setHeroIndex(0); }} />
        <VaultToolbar items={exportItems} accent={showcase.accent} exportLabel={`Export ${showcase.singular.toLowerCase()} set`} />
      </div>

      {/* display mode switch */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1.5" role="tablist" aria-label="Display modes">
        {DISPLAY_MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            title={m.hint}
            onClick={() => setMode(m.key)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
              mode === m.key
                ? "bg-trophy/15 text-trophy border border-trophy/50"
                : "border border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ---------------- display modes ---------------- */}

      {(mode === "showcase" || mode === "fullscreen" || mode === "carousel") && (
        <section className="space-y-3">
          <MuseumStage {...stageFor(hero, mode === "fullscreen" ? 620 : 480, "full")} eager
            onExpand={() => setFullscreenSlug(hero.slug)} />
          <div className="flex flex-wrap items-center gap-2">
            {visible.map((r, i) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => setHeroIndex(i)}
                aria-pressed={hero.slug === r.slug}
                className="rounded-lg border px-2.5 py-1.5 text-[11px] transition"
                style={{
                  borderColor: hero.slug === r.slug ? r.accent : `${r.accent}33`,
                  background: hero.slug === r.slug ? `${r.accent}22` : "transparent",
                  color: `${r.accent}dd`,
                }}
              >
                {r.glyph} {r.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {ROLE_ENVIRONMENT[hero.slug].name} — {ROLE_ENVIRONMENT[hero.slug].vibe}
          </p>
        </section>
      )}

      {mode === "comparison" && (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">Select up to two roles to inspect side by side.</p>
          <div className="flex flex-wrap gap-2">
            {visible.map((r) => (
              <button
                key={r.slug} type="button"
                onClick={() => setCompare((c) => c.includes(r.slug) ? c.filter((s) => s !== r.slug) : [...c, r.slug].slice(-2))}
                aria-pressed={compare.includes(r.slug)}
                className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                style={{
                  borderColor: compare.includes(r.slug) ? r.accent : `${r.accent}33`,
                  background: compare.includes(r.slug) ? `${r.accent}22` : "transparent",
                  color: `${r.accent}dd`,
                }}
              >
                {r.glyph} {r.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(compare.length ? compare : visible.slice(0, 2).map((r) => r.slug)).map((slug) => {
              const role = ROLES.find((r) => r.slug === slug)!;
              return (
                <div key={slug} className="space-y-2">
                  <MuseumStage {...stageFor(role, 420, "full")} onExpand={() => setFullscreenSlug(slug)} />
                  <div className="text-sm font-semibold text-foreground">{role.name}</div>
                  <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                    {role.archetype} · {ROLE_ENVIRONMENT[role.slug].name}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mode === "timeline" && (
        <ol className="relative space-y-6 border-l border-border/60 pl-6">
          {visible.map((role, i) => (
            <li key={role.slug} className="relative">
              <span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full"
                style={{ background: role.accent, boxShadow: `0 0 12px ${role.accent}` }} />
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Chapter {String(i + 1).padStart(2, "0")} · {role.name}
              </div>
              <MuseumStage {...stageFor(role, 320)} onExpand={() => setFullscreenSlug(role.slug)} />
            </li>
          ))}
        </ol>
      )}

      {mode === "tabletop" && (
        <div className="rounded-3xl border border-border/60 p-4"
          style={{ background: "linear-gradient(180deg, rgba(60,40,24,0.35), rgba(10,8,6,0.6))" }}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((role) => (
              <MuseumStage key={role.slug} {...stageFor(role, 300)} onExpand={() => setFullscreenSlug(role.slug)} />
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
            Tabletop presentation · walnut desk · real size preview available
          </p>
        </div>
      )}

      {mode === "shelf" && (
        <div className="space-y-6">
          {chunk(visible, 4).map((row, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-black/25 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {row.map((role) => (
                  <MuseumStage key={role.slug} {...stageFor(role, 260)} onExpand={() => setFullscreenSlug(role.slug)} />
                ))}
              </div>
              <div className="mt-3 h-2 rounded-full bg-gradient-to-b from-amber-200/50 to-amber-900/40" />
            </div>
          ))}
        </div>
      )}

      {(mode === "gallery" || mode === "museum" || mode === "collection") && (
        <div className={cn(
          "grid gap-6",
          mode === "collection" ? "sm:grid-cols-2 xl:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}>
          {visible.map((role) => {
            const env = ROLE_ENVIRONMENT[role.slug];
            return (
              <article
                key={role.slug}
                data-collectible-card={role.slug}
                className={cn(
                  "overflow-hidden rounded-2xl border border-border/60 bg-black/20 motion-card",
                  mode === "museum" && "ring-1 ring-inset ring-white/5",
                )}
              >
                <MuseumStage
                  {...stageFor(role, mode === "collection" ? 460 : 360, mode === "museum" ? "full" : "compact")}
                  onExpand={() => setFullscreenSlug(role.slug)}
                />
                <div className="p-4">
                  <div className="text-lg font-semibold text-foreground">{role.name}</div>
                  <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                    {role.archetype} · {showcase.singular}
                  </div>
                  <p className="mt-2 text-xs italic text-muted-foreground">&quot;{role.motto}&quot;</p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    <Sparkles className="h-3 w-3" style={{ color: role.accent }} />
                    {env.name}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {fullscreenRole && (
        <MuseumFullscreen
          open
          onClose={() => setFullscreenSlug(null)}
          {...stageFor(fullscreenRole, 720, "full")}
        />
      )}
    </div>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
