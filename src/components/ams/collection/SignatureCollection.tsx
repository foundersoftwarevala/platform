import { useMemo, useState } from "react";
import { Crown, Gem, Lock, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { MuseumFullscreen, MuseumStage } from "@/components/ams/museum/MuseumStage";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";
import { SVMicroMark } from "@/components/ams/brand/SVMark";
import { ROLES } from "@/lib/ams/roles";
import { ROLE_ENVIRONMENT } from "@/lib/ams/museum";
import {
  COLLECTION_LAYOUTS, buildRoleCollection,
  type CollectionLayout, type CollectionPiece, type CollectionTypeDef, type RoleCollection,
} from "@/lib/ams/signature-collection";
import { cn } from "@/lib/utils";

/**
 * SignatureCollection — presentation shell for a full career collection.
 * Never a single item: every role shows its 10 career-stage pieces, with the
 * first unlocked piece staged large and the rest displayed as collectibles.
 * Locked pieces stay visible behind premium dark glass so the next unlock is
 * always readable. Pure UI.
 */
export function SignatureCollection({ type }: { type: CollectionTypeDef }) {
  const [filter, setFilter] = useState<RoleFilterValue>("all");
  const [layout, setLayout] = useState<CollectionLayout>("cabinet");
  const [activeRole, setActiveRole] = useState(ROLES[0].slug);
  const [heroIndex, setHeroIndex] = useState(0);
  const [zoomPiece, setZoomPiece] = useState<CollectionPiece | null>(null);

  const collections: RoleCollection[] = useMemo(
    () =>
      (filter === "all" ? ROLES : ROLES.filter((r) => r.slug === filter)).map((r) =>
        buildRoleCollection({
          slug: r.slug, name: r.name, accent: r.accent, passportPrefix: r.passportPrefix, type,
        }),
      ),
    [filter, type],
  );

  const current =
    collections.find((c) => c.role === activeRole) ?? collections[0];
  const heroPiece = current.pieces[Math.min(heroIndex, current.pieces.length - 1)];
  const env = ROLE_ENVIRONMENT[current.role];

  const exportItems = useMemo(
    () => current.pieces.filter((p) => p.unlocked).map((p) => ({ src: p.src, filename: p.filename })),
    [current],
  );

  const stageProps = (piece: CollectionPiece, height: number, chrome: "compact" | "full") => ({
    src: piece.src,
    filename: piece.filename,
    accent: piece.stage.hue,
    label: `${piece.collectionNumber} · ${piece.stage.label}`,
    environment: ROLE_ENVIRONMENT[current.role],
    material: piece.stage.material,
    height,
    chrome,
    unlockTitle: `${piece.title} Unveiled`,
    unlockSubtitle: `${piece.stage.stage} · ${piece.stage.rarity} · Edition ${piece.editionNumber}`,
  });

  const totalUnlocked = collections.reduce((n, c) => n + c.unlockedCount, 0);
  const totalPieces = collections.reduce((n, c) => n + c.pieces.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/80">
            Software Vala · {type.kicker}
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-foreground lg:text-4xl">{type.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{type.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            {type.display}
          </span>
          <span className="inline-flex items-center gap-2">
            <Gem className="h-3.5 w-3.5 text-primary/70" />
            {totalUnlocked} of {totalPieces} pieces collected
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setHeroIndex(0);
            if (v !== "all") setActiveRole(v);
          }}
        />
        <VaultToolbar
          items={exportItems}
          accent={type.accent}
          exportLabel={`Export ${current.roleName.toLowerCase()} collection`}
        />
      </div>

      {/* role collection selector */}
      <div className="flex flex-wrap gap-2">
        {collections.map((c) => (
          <button
            key={c.role}
            type="button"
            aria-pressed={c.role === current.role}
            onClick={() => { setActiveRole(c.role); setHeroIndex(0); }}
            className="rounded-lg border px-2.5 py-1.5 text-[11px] transition"
            style={{
              borderColor: c.role === current.role ? c.accent : `${c.accent}33`,
              background: c.role === current.role ? `${c.accent}22` : "transparent",
              color: `${c.accent}dd`,
            }}
          >
            {c.roleName} · {c.unlockedCount}/{c.pieces.length}
          </button>
        ))}
      </div>

      {/* layout switch */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1.5" role="tablist" aria-label="Collection layouts">
        {COLLECTION_LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            role="tab"
            aria-selected={layout === l.key}
            title={l.hint}
            onClick={() => setLayout(l.key)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
              layout === l.key
                ? "border border-trophy/50 bg-trophy/15 text-trophy"
                : "border border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ------------ hero + collection ------------ */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <MuseumStage {...stageProps(heroPiece, 560, "full")} eager onExpand={() => setZoomPiece(heroPiece)} />
          <SpecPlate piece={heroPiece} roleName={current.roleName} type={type} large />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous piece"
              onClick={() => setHeroIndex((i) => (i - 1 + current.pieces.length) % current.pieces.length)}
              className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {env.name} — {env.vibe}
            </p>
            <button
              type="button"
              aria-label="Next piece"
              onClick={() => setHeroIndex((i) => (i + 1) % current.pieces.length)}
              className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {current.family} · career ladder
          </div>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            {current.pieces.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setHeroIndex(p.index)}
                  aria-pressed={p.index === heroPiece.index}
                  className={cn(
                    "w-full rounded-xl border p-2 text-left transition motion-card",
                    p.index === heroPiece.index ? "border-trophy/60 bg-trophy/10" : "border-border/50 bg-black/20 hover:bg-muted/20",
                  )}
                >
                  <Thumb piece={p} />
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium text-foreground">{p.stage.label}</span>
                    {p.unlocked
                      ? <Sparkles className="h-3 w-3" style={{ color: p.stage.hue }} />
                      : <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    {p.stage.rarity}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------ layouts ------------ */}

      {layout === "cabinet" && (
        <div className="space-y-6">
          {chunk(current.pieces, 5).map((row, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-black/30 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {row.map((p) => (
                  <PieceCard key={p.id} piece={p} roleName={current.roleName} type={type}
                    onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={230} />
                ))}
              </div>
              <div className="mt-3 h-2 rounded-full bg-gradient-to-b from-amber-200/50 to-amber-900/40" />
            </div>
          ))}
        </div>
      )}

      {layout === "horizontal" && (
        <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-3">
          {current.pieces.map((p) => (
            <div key={p.id} className="w-[280px] shrink-0 snap-start">
              <PieceCard piece={p} roleName={current.roleName} type={type}
                onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={300} />
            </div>
          ))}
        </div>
      )}

      {layout === "grid" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {current.pieces.map((p) => (
            <PieceCard key={p.id} piece={p} roleName={current.roleName} type={type}
              onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={280} />
          ))}
        </div>
      )}

      {layout === "museum" && (
        <div className="rounded-3xl border border-border/60 p-4" style={{ background: env.backdrop }}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {current.pieces.map((p) => (
              <PieceCard key={p.id} piece={p} roleName={current.roleName} type={type}
                onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={320} chrome="full" />
            ))}
          </div>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {env.name} · museum ambience · reflection floor
          </p>
        </div>
      )}

      {layout === "carousel" && (
        <div className="space-y-3">
          <div className="flex items-stretch gap-4 overflow-x-auto pb-3">
            {rotate(current.pieces, heroIndex).map((p, i) => (
              <div key={p.id} className={cn("shrink-0 transition-all", i === 0 ? "w-[360px]" : "w-[220px] opacity-80")}>
                <PieceCard piece={p} roleName={current.roleName} type={type}
                  onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={i === 0 ? 340 : 220} />
              </div>
            ))}
          </div>
        </div>
      )}

      {layout === "timeline" && (
        <ol className="relative space-y-6 border-l border-border/60 pl-6">
          {current.pieces.map((p) => (
            <li key={p.id} className="relative">
              <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full"
                style={{ background: p.stage.hue, boxShadow: `0 0 12px ${p.stage.hue}` }} />
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Stage {String(p.index + 1).padStart(2, "0")} · {p.stage.stage} · {p.unlockDate ?? "Locked"}
              </div>
              <div className="max-w-md">
                <PieceCard piece={p} roleName={current.roleName} type={type}
                  onExpand={() => setZoomPiece(p)} stageProps={stageProps} height={260} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {zoomPiece && zoomPiece.unlocked && (
        <MuseumFullscreen open onClose={() => setZoomPiece(null)} {...stageProps(zoomPiece, 720, "full")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Thumb({ piece }: { piece: CollectionPiece }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: "1 / 1" }}>
      <img
        src={piece.src}
        alt={piece.unlocked ? piece.title : `${piece.stage.label} — locked`}
        loading="lazy"
        className={cn("h-full w-full object-contain", !piece.unlocked && "blur-[6px] brightness-[0.35] saturate-50")}
      />
      {!piece.unlocked && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <Lock className="h-4 w-4 text-white/70" />
        </div>
      )}
    </div>
  );
}

function PieceCard({
  piece, roleName, type, onExpand, stageProps, height, chrome = "compact",
}: {
  piece: CollectionPiece;
  roleName: string;
  type: CollectionTypeDef;
  onExpand: () => void;
  stageProps: (p: CollectionPiece, h: number, c: "compact" | "full") => Parameters<typeof MuseumStage>[0];
  height: number;
  chrome?: "compact" | "full";
}) {
  return (
    <article
      data-collection-piece={piece.id}
      className={cn(
        "overflow-hidden rounded-2xl border bg-black/25 motion-card",
        piece.unlocked ? "border-border/60" : "border-border/40",
      )}
    >
      {piece.unlocked ? (
        <MuseumStage {...stageProps(piece, height, chrome)} onExpand={onExpand} />
      ) : (
        <LockedStage piece={piece} height={height} />
      )}
      <SpecPlate piece={piece} roleName={roleName} type={type} />
    </article>
  );
}

function LockedStage({ piece, height }: { piece: CollectionPiece; height: number }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height,
        background:
          "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.06), transparent 65%), linear-gradient(180deg, #06080e 0%, #0a0e17 60%, #04060b 100%)",
      }}
    >
      <img
        src={piece.src}
        alt={`${piece.stage.label} ${piece.title} — locked silhouette`}
        loading="lazy"
        className="h-full w-full object-contain blur-[10px] brightness-[0.3] saturate-[0.4]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,10,0.35),rgba(3,5,10,0.75))]" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/70">
          <Lock className="h-3 w-3" /> Locked · {piece.stage.rarity}
        </span>
        <SVMicroMark accent={piece.stage.hue} />
      </div>
      <div className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
        Next unlock · {piece.stage.stage}
      </div>
    </div>
  );
}

function SpecPlate({
  piece, roleName, type, large = false,
}: { piece: CollectionPiece; roleName: string; type: CollectionTypeDef; large?: boolean }) {
  return (
    <div className={cn("border-t border-border/50 bg-black/30 p-4", large && "rounded-2xl border")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cn("font-semibold text-foreground", large ? "text-xl" : "text-sm")}>
            {piece.stage.label} {type.singular}
          </div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: `${piece.stage.hue}cc` }}>
            {roleName} · {piece.stage.stage}
          </div>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{ borderColor: `${piece.stage.hue}66`, color: `${piece.stage.hue}dd` }}
        >
          {piece.stage.rarity}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
        <Spec label="Collection" value={piece.collectionNumber} />
        <Spec label="Edition" value={piece.editionNumber} />
        <Spec label="Serial" value={piece.serialNumber} />
        <Spec label="Unlocked" value={piece.unlockDate ?? "— locked"} />
        <Spec label="Material" value={piece.stage.material} />
        <Spec label="Silhouette" value={piece.stage.silhouette} />
        {large && <Spec label="Base" value={piece.stage.base} />}
        {large && <Spec label="Crown" value={piece.stage.crown} />}
        {large && <Spec label="Core" value={piece.stage.core} />}
        {large && <Spec label="Geometry" value={piece.stage.geometry} />}
        {large && <Spec label="Engraving" value={piece.stage.detail} />}
        <Spec label="Family" value={piece.family} />
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Software Vala · signature series
        </span>
        <SVMicroMark accent={piece.stage.hue} />
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-[0.2em] text-muted-foreground/60">{label}</dt>
      <dd className="text-foreground/85">{value}</dd>
    </div>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function rotate<T>(list: T[], start: number): T[] {
  if (!list.length) return list;
  const i = ((start % list.length) + list.length) % list.length;
  return [...list.slice(i), ...list.slice(0, i)];
}
