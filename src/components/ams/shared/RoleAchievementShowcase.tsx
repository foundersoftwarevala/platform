// Role Achievement Showcase — profession-specific luxury 3D collectibles.
// The signature trophy is a real cinematic 3D render per role. Every role has
// its own icon set, palette, silhouettes and label set. Nothing is reused.

import { useEffect, useMemo, useState } from "react";
import { ROLES, type RoleDNA, type RoleSlug } from "@/lib/ams/roles";
import { ROLE_TROPHY as TROPHY_IMG } from "@/lib/ams/role-assets";
import { MuseumCase, SVMicroMark, SVSeal, svCollectionNumber } from "@/components/ams/brand/SVMark";

type SlotKey =
  | "trophy" | "award" | "badge" | "passport"
  | "rank" | "level" | "membership" | "verification";

// Per-role profession-specific glyphs for the non-trophy slots — never
// reused between roles.
const PROF_GLYPH: Record<RoleSlug, Record<Exclude<SlotKey, "trophy">, string>> = {
  developer:  { award: "</>",   badge: "⌘",  passport: "⎇",  rank: "◈", level: "▲", membership: "◆", verification: "✓" },
  reseller:   { award: "$",     badge: "▲$", passport: "$$", rank: "♛", level: "★", membership: "♦", verification: "✓" },
  franchise:  { award: "◉",     badge: "⚑",  passport: "⌾",  rank: "♚", level: "☗", membership: "◈", verification: "✓" },
  author:     { award: "✒",     badge: "❦",  passport: "❧",  rank: "♜", level: "❋", membership: "❖", verification: "✓" },
  vendor:     { award: "🛍",    badge: "▤",  passport: "▦",  rank: "▣", level: "▧", membership: "▩", verification: "✓" },
  affiliate:  { award: "∞",     badge: "⇌",  passport: "⇆",  rank: "⟁", level: "⌘", membership: "◇", verification: "✓" },
  influencer: { award: "▶",     badge: "♥",  passport: "❤",  rank: "☆", level: "✧", membership: "❥", verification: "✓" },
  creator:    { award: "✦",     badge: "❈",  passport: "✺",  rank: "❉", level: "✵", membership: "◈", verification: "✓" },
  seo:        { award: "⌕",     badge: "↗",  passport: "⌗",  rank: "⇞", level: "△", membership: "◇", verification: "✓" },
  support:    { award: "♥",     badge: "☏",  passport: "✚",  rank: "★", level: "✦", membership: "◈", verification: "✓" },
  user:       { award: "❦",     badge: "❤",  passport: "◐",  rank: "☆", level: "✧", membership: "◇", verification: "✓" },
  manager:    { award: "◑",     badge: "⌖",  passport: "◉",  rank: "▲", level: "◆", membership: "◇", verification: "✓" },
  administrator: { award: "⌗", badge: "⬟", passport: "◈", rank: "♜", level: "▲", membership: "◆", verification: "✓" },
  founder:    { award: "✦",     badge: "★",  passport: "❂",  rank: "♛", level: "✧", membership: "◆", verification: "✓" },
  operator:   { award: "◎",     badge: "⚙",  passport: "◍",  rank: "▲", level: "◈", membership: "◇", verification: "✓" },
};

interface Slot { key: SlotKey; kicker: string; }
const SLOTS: Slot[] = [
  { key: "trophy",       kicker: "Signature Trophy" },
  { key: "award",        kicker: "Latest Award" },
  { key: "badge",        kicker: "Featured Badge" },
  { key: "passport",     kicker: "Digital Passport" },
  { key: "rank",         kicker: "Current Rank" },
  { key: "level",        kicker: "Current Level" },
  { key: "membership",   kicker: "Membership" },
  { key: "verification", kicker: "Verification" },
];

const OVERRIDES: Partial<Record<RoleSlug, Partial<Record<SlotKey, string>>>> = {
  reseller:   { trophy: "Million Dollar Club",       award: "Revenue King Crown",         badge: "Sales Diamond",         passport: "Reseller Passport" },
  franchise:  { trophy: "Global Empire",             award: "Business Empire Award",      badge: "Leadership Crown",      passport: "Franchise Passport" },
  author:     { trophy: "Gold Pen",                  award: "Master Publisher",           badge: "Creative Crown",        passport: "Author Passport" },
  vendor:     { trophy: "Trusted Seller",            award: "Marketplace Excellence",     badge: "Quality Merchant",      passport: "Vendor Passport" },
  affiliate:  { trophy: "Referral King",             award: "Conversion Champion",        badge: "Partner Excellence",    passport: "Affiliate Passport" },
  influencer: { trophy: "Creator Diamond",           award: "Brand Ambassador",           badge: "Influence Crown",       passport: "Influencer Passport" },
  developer:  { trophy: "Code Excellence",           award: "Architecture Master",        badge: "Elite Developer",       passport: "Developer Passport" },
  support:    { trophy: "Customer Hero",             award: "Five Star Service",          badge: "Fast Resolution",       passport: "Support Passport" },
  seo:        { trophy: "Search King",               award: "Organic Growth",             badge: "SEO Expert",            passport: "SEO Passport" },
  creator:    { trophy: "Creative Master",           award: "Design Innovation",          badge: "Prism Master",          passport: "Creator Passport" },
  user:       { trophy: "Loyalty",                   award: "Community Star",             badge: "Verified Member",       passport: "User Passport" },
};

// Different silhouettes for every slot so no two collectibles share a shape.
const FRAME_CLIP: Record<Exclude<SlotKey, "trophy">, string> = {
  award:        "circle(50% at 50% 50%)",
  badge:        "polygon(50% 0, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
  passport:     "inset(6% 4% 6% 4% round 12px)",
  rank:         "polygon(50% 0, 100% 35%, 82% 100%, 18% 100%, 0 35%)",
  level:        "polygon(50% 4%, 62% 38%, 98% 38%, 68% 60%, 80% 96%, 50% 74%, 20% 96%, 32% 60%, 2% 38%, 38% 38%)",
  membership:   "polygon(50% 0, 100% 35%, 50% 100%, 0 35%)",
  verification: "path('M50,2 L92,18 L92,54 C92,78 74,94 50,100 C26,94 8,78 8,54 L8,18 Z')",
};

function Sparkles({ accent }: { accent: string }) {
  const dots = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({
      i,
      left: 8 + Math.random() * 84,
      top:  8 + Math.random() * 84,
      sx:   (Math.random() * 24 - 12).toFixed(1) + "px",
      sy:   (Math.random() * -30 - 4).toFixed(1) + "px",
      d:    (Math.random() * 2.6).toFixed(2) + "s",
    })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.i}
          className="absolute h-1.5 w-1.5 rounded-full trophy-sparkle"
          style={{
            left: `${d.left}%`,
            top:  `${d.top}%`,
            background: accent,
            boxShadow: `0 0 8px ${accent}, 0 0 16px ${accent}88`,
            animationDelay: d.d,
            // consumed by keyframes
            ["--sx" as any]: d.sx,
            ["--sy" as any]: d.sy,
          }}
        />
      ))}
    </div>
  );
}

function TrophyTile({ role, unlockKey, label }: { role: RoleDNA; unlockKey: string; label: string }) {
  const accent = role.accent;
  return (
    <div className="group relative flex flex-col items-center gap-2 col-span-2 row-span-2 md:col-span-2 md:row-span-2">
      {/* Luxury presentation stage */}
      <div
        key={unlockKey}
        className="trophy-unlock relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border"
        style={{
          borderColor: `${accent}55`,
          background: `
            radial-gradient(120% 80% at 50% 110%, ${accent}44 0%, ${accent}11 40%, transparent 70%),
            radial-gradient(80% 60% at 50% 0%,   ${accent}22 0%, transparent 65%),
            linear-gradient(180deg, #05060c, #0b0d16 60%, #05060c)`,
          boxShadow: `inset 0 0 60px ${accent}22, 0 20px 60px -20px ${accent}66`,
        }}
      >
        {/* museum spotlight cone */}
        <div
          className="absolute inset-x-1/4 -top-6 h-40 opacity-40 blur-2xl"
          style={{ background: `radial-gradient(50% 100% at 50% 0%, ${accent}, transparent 70%)` }}
        />
        {/* rotating pedestal ring */}
        <div className="absolute left-1/2 bottom-6 -translate-x-1/2 h-24 w-[70%]">
          <div
            className="absolute inset-0 rounded-[50%] trophy-glow"
            style={{
              background: `radial-gradient(50% 50% at 50% 50%, ${accent}66, transparent 70%)`,
              filter: "blur(6px)",
            }}
          />
        </div>
        {/* the trophy itself — slow float + 3D rotate */}
        <div className="absolute inset-0 grid place-items-center [perspective:1000px]">
          <img
            src={TROPHY_IMG[role.slug]}
            alt={`${role.name} — ${label}`}
            loading="lazy"
            width={512}
            height={512}
            className="trophy-float relative z-10 h-[86%] w-[86%] object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
          />
        </div>
        {/* animated shine sweep */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 h-full w-1/3 trophy-shine"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}22, transparent)` }}
          />
        </div>
        {/* sparkle particles */}
        <Sparkles accent={accent} />
        {/* Software Vala museum case + verification seal */}
        <MuseumCase accent={accent} />
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <SVSeal accent={accent} size={22} />
          <SVMicroMark accent={accent} />
        </div>

        {/* nameplate strip */}
        <div
          className="absolute inset-x-3 bottom-3 rounded-md border px-3 py-2 text-center backdrop-blur-sm"
          style={{
            borderColor: `${accent}66`,
            background: `linear-gradient(180deg, ${accent}18, #00000055)`,
          }}
        >
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Signature Trophy</div>
          <div className="text-sm font-semibold tracking-wide" style={{ color: accent }}>{label}</div>
          <div className="mt-0.5 font-mono uppercase text-muted-foreground" style={{ fontSize: 8, letterSpacing: "0.22em" }}>
            {svCollectionNumber(`${role.slug}-trophy`, role.passportPrefix)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotTile({ role, slot, label }: { role: RoleDNA; slot: Exclude<SlotKey, "trophy">; label: string }) {
  const clip = FRAME_CLIP[slot];
  const accent = role.accent;
  const glyph = PROF_GLYPH[role.slug][slot];

  return (
    <div className="group flex flex-col items-center gap-1.5 min-w-0">
      <div
        className="relative h-20 w-20 shrink-0 transition-transform duration-500 group-hover:-translate-y-1"
        style={{ filter: `drop-shadow(0 10px 18px ${accent}55) drop-shadow(0 0 1px ${accent}aa)` }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: clip, WebkitClipPath: clip,
            background: `
              radial-gradient(120% 100% at 30% 15%, ${accent}ee 0%, ${accent}55 40%, #06070d 80%),
              linear-gradient(160deg, ${accent}33, transparent 60%)`,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-screen opacity-70 pointer-events-none"
          style={{
            clipPath: clip, WebkitClipPath: clip,
            background: `linear-gradient(180deg, ${accent}88, transparent 55%, ${accent}22 100%)`,
          }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <div className="font-bold leading-none text-lg" style={{ color: "#0a0a12", textShadow: `0 1px 0 ${accent}` }}>
            {glyph}
          </div>
        </div>
        {/* Software Vala engraved back plate + glass highlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath: clip, WebkitClipPath: clip,
            background: "linear-gradient(122deg, rgba(255,255,255,0.16), transparent 34%, transparent 68%, rgba(255,255,255,0.1))",
            mixBlendMode: "screen",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-[3px] flex justify-center">
          <span className="font-mono uppercase" style={{ fontSize: 5, letterSpacing: "0.3em", color: "#0a0a1299" }}>SV</span>
        </div>
      </div>
      <div className="text-center w-full">
        <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{SLOTS.find(s => s.key === slot)!.kicker}</div>
        <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: accent }}>{label}</div>
      </div>
    </div>
  );
}

export function RoleAchievementShowcase({
  defaultRole = "developer" as RoleSlug,
  name,
}: { defaultRole?: RoleSlug; name?: string }) {
  const [slug, setSlug] = useState<RoleSlug>(defaultRole);
  const role = useMemo(() => ROLES.find((r) => r.slug === slug)!, [slug]);
  const [unlockKey, setUnlockKey] = useState(0);
  useEffect(() => { setUnlockKey((k) => k + 1); }, [slug]);

  const ov = OVERRIDES[role.slug] ?? {};
  const labels: Record<SlotKey, string> = {
    trophy:       ov.trophy       ?? role.trophies[3].label,
    award:        ov.award        ?? role.awardExamples[3],
    badge:        ov.badge        ?? role.badges[4].label,
    passport:     ov.passport     ?? `${role.name} Passport`,
    rank:         role.trophies[5].label,
    level:        role.careerPath[Math.min(3, role.careerPath.length - 1)],
    membership:   role.trophies[4].label,
    verification: role.passport.verification,
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border/60 p-5"
      style={{
        background: `
          radial-gradient(900px 220px at 8% -20%, ${role.accent}22, transparent 60%),
          radial-gradient(700px 200px at 100% 0%, ${role.accent}11, transparent 55%),
          linear-gradient(180deg, #05060c, #0a0b12)`,
      }}
    >
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Role Achievement Showcase</div>
          <h2 className="text-lg font-semibold tracking-tight">
            {name ? `${name} · ` : ""}
            <span style={{ color: role.accent }}>{role.name}</span>
            <span className="text-muted-foreground text-sm font-normal"> — {role.archetype}</span>
          </h2>
          <p className="text-[11px] text-muted-foreground italic mt-0.5">"{role.motto}"</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => {
            const active = r.slug === role.slug;
            return (
              <button
                key={r.slug}
                type="button"
                onClick={() => setSlug(r.slug)}
                className="text-[10px] uppercase tracking-[0.14em] rounded-md border px-2 py-1 transition-colors"
                style={{
                  borderColor: active ? r.accent : `${r.accent}44`,
                  color: active ? "#0a0a12" : r.accent,
                  background: active ? r.accent : `${r.accent}11`,
                }}
                aria-pressed={active}
              >
                <span className="mr-1">{r.glyph}</span>{r.name}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
        <TrophyTile role={role} unlockKey={`${role.slug}-${unlockKey}`} label={labels.trophy} />
        <div className="col-span-4 md:col-span-4 grid grid-cols-4 gap-3">
          {(SLOTS.slice(1) as { key: Exclude<SlotKey, "trophy">; kicker: string }[]).map((s) => (
            <SlotTile key={s.key} role={role} slot={s.key} label={labels[s.key]} />
          ))}
        </div>
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Passport · <span style={{ color: role.accent }}>{role.passportPrefix}-00001</span></span>
        <span>Verification · <span style={{ color: role.accent }}>{role.passport.verification}</span></span>
        <span>Signature · <span style={{ color: role.accent }}>{role.signature}</span></span>
        <span className="inline-flex items-center gap-1.5">
          <SVSeal accent={role.accent} size={14} title="Software Vala Collection Mark" />
          Software Vala Collection · <span style={{ color: role.accent }}>{svCollectionNumber(role.slug, role.passportPrefix)}</span>
        </span>
      </footer>
    </section>
  );
}
