import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trophy, Volume2, Sparkles } from "lucide-react";
import { ROLES } from "@/lib/ams/roles";
import { playUnlock, type UnlockPreset } from "@/lib/ams/trophy-sounds";
import { MuseumCase, SVMicroMark, SVSeal, svCollectionNumber } from "@/components/ams/brand/SVMark";

import affiliate from "@/assets/trophies/affiliate.png";
import author from "@/assets/trophies/author.png";
import creator from "@/assets/trophies/creator.png";
import developer from "@/assets/trophies/developer.png";
import franchise from "@/assets/trophies/franchise.png";
import influencer from "@/assets/trophies/influencer.png";
import reseller from "@/assets/trophies/reseller.png";
import seo from "@/assets/trophies/seo.png";
import support from "@/assets/trophies/support.png";
import user from "@/assets/trophies/user.png";
import vendor from "@/assets/trophies/vendor.png";
import manager from "@/assets/trophy-stages/manager-01.png";
import administrator from "@/assets/trophy-stages/administrator-01.png";
import founder from "@/assets/trophy-stages/founder-01.png";
import operator from "@/assets/trophy-stages/operator-01.png";

const TROPHY: Record<string, string> = {
  developer, reseller, franchise, author, vendor, affiliate,
  influencer, creator, seo, support, user, manager, administrator, founder, operator,
};

// Museum-quality theme per role — no two identities repeat.
const ROLE_THEME: Record<string, { grad: string; particle: string; unlock: UnlockPreset; material: string; shape: string }> = {
  developer:  { grad: "radial-gradient(900px 400px at 20% 0%, rgba(34,211,238,0.28), transparent 60%), linear-gradient(160deg,#061620,#02080d)", particle: "#7defff", unlock: "diamond", material: "Cyan Crystal · Circuit Base", shape: "Hexagonal Chip Trophy" },
  reseller:   { grad: "radial-gradient(900px 400px at 80% 0%, rgba(251,191,36,0.32), transparent 60%), linear-gradient(160deg,#1a1204,#0a0702)", particle: "#ffe28a", unlock: "gold", material: "24k Gold · Onyx Plinth", shape: "Growth Diamond Cup" },
  franchise:  { grad: "radial-gradient(900px 400px at 40% 0%, rgba(244,114,182,0.30), transparent 60%), linear-gradient(160deg,#180810,#0a0308)", particle: "#ffb0d4", unlock: "elite", material: "Rose Gold · Wax Crest", shape: "Regal Shield Standard" },
  author:     { grad: "radial-gradient(900px 400px at 60% 0%, rgba(167,139,250,0.30), transparent 60%), linear-gradient(160deg,#0f091a,#050310)", particle: "#d9c9ff", unlock: "silver", material: "Amethyst · Ink Marble", shape: "Feathered Quill Obelisk" },
  vendor:     { grad: "radial-gradient(900px 400px at 30% 0%, rgba(52,211,153,0.30), transparent 60%), linear-gradient(160deg,#04180f,#02090a)", particle: "#8affd0", unlock: "silver", material: "Emerald Glass · Marble", shape: "Storefront Arch Cup" },
  affiliate:  { grad: "radial-gradient(900px 400px at 50% 0%, rgba(96,165,250,0.30), transparent 60%), linear-gradient(160deg,#04101c,#020610)", particle: "#a5c9ff", unlock: "bronze", material: "Sapphire · Node Grid", shape: "Network Orb & Rings" },
  influencer: { grad: "radial-gradient(900px 400px at 40% 0%, rgba(236,72,153,0.32), transparent 60%), linear-gradient(160deg,#1a061a,#0a020f)", particle: "#ffb2df", unlock: "legend", material: "Neon Rose Chrome", shape: "Broadcast Wave Star" },
  creator:    { grad: "radial-gradient(900px 400px at 60% 0%, rgba(251,146,60,0.32), transparent 60%), linear-gradient(160deg,#1a0d05,#0a0402)", particle: "#ffcf9a", unlock: "gold", material: "Copper Fire · Prism Base", shape: "Flame Spire Sculpture" },
  seo:        { grad: "radial-gradient(900px 400px at 40% 0%, rgba(74,222,128,0.30), transparent 60%), linear-gradient(160deg,#04180d,#01090a)", particle: "#b9ffd1", unlock: "silver", material: "Malachite · Chrome Ring", shape: "Ranking Ladder Compass" },
  support:    { grad: "radial-gradient(900px 400px at 50% 0%, rgba(56,189,248,0.30), transparent 60%), linear-gradient(160deg,#04121a,#020810)", particle: "#a6e6ff", unlock: "bronze", material: "Sky Crystal · Steel Halo", shape: "Guardian Halo Shield" },
  user:       { grad: "radial-gradient(900px 400px at 50% 0%, rgba(148,163,184,0.28), transparent 60%), linear-gradient(160deg,#0e1319,#04070a)", particle: "#e2e8f0", unlock: "starter", material: "Silver Frost · Etched Base", shape: "First-Step Star Trophy" },
};

export const Route = createFileRoute("/ams/trophy-gallery")({
  head: () => ({
    meta: [
      { title: "Trophy Gallery — Museum of Roles" },
      { name: "description", content: "Every profession, its own luxury trophy — a museum-quality showcase across all AMS roles." },
      { property: "og:title", content: "Trophy Gallery — Museum of Roles" },
      { property: "og:description", content: "Every profession, its own luxury trophy — a museum-quality showcase across all AMS roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Museum Wing</div>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Trophy Gallery</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            A world-class collection of luxury trophies — one utterly unique identity per profession.
            Ultra-realistic materials, engraved nameplates, cinematic lighting and premium unlock sound.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} professions · {ROLES.length * 7} named trophies</span>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((role) => (
          <TrophyDisplayCase key={role.slug} role={role} />
        ))}
      </div>
    </div>
  );
}

function TrophyDisplayCase({ role }: { role: (typeof ROLES)[number] }) {
  const theme = ROLE_THEME[role.slug] ?? ROLE_THEME.user;
  const [tierIdx, setTierIdx] = useState(role.trophies.length - 1);
  const tier = role.trophies[tierIdx];
  const [pulse, setPulse] = useState(false);

  function play() {
    playUnlock(theme.unlock);
    setPulse(false);
    requestAnimationFrame(() => setPulse(true));
    setTimeout(() => setPulse(false), 2400);
  }

  return (
    <article
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background: theme.grad,
        borderColor: `${role.accent}55`,
        boxShadow: `0 30px 60px -30px ${role.accent}80, inset 0 0 0 1px ${role.accent}22`,
      }}
    >
      {/* museum spotlight */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${role.accent}55, transparent)` }} />

      {/* sparkles */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i}
            className="absolute h-1 w-1 rounded-full trophy-sparkle"
            style={{
              left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 60}%`,
              background: theme.particle, boxShadow: `0 0 10px ${theme.particle}`,
              animationDelay: `${Math.random() * 2}s`,
              // @ts-expect-error CSS var
              "--sx": `${(Math.random() - 0.5) * 30}px`, "--sy": `-${20 + Math.random() * 30}px`,
            }} />
        ))}
      </div>

      <div className="relative z-10 flex items-start justify-between p-5">
        <div>
          <div className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: role.accent }}>
            {role.passportPrefix}
          </div>
          <div className="mt-1 text-xl font-semibold text-white">{role.name}</div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
            {role.archetype} · {role.trophyStyle}
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 rounded-full"
          style={{ background: `${role.accent}22`, color: role.accent, border: `1px solid ${role.accent}55` }}>
          {tier.label}
        </span>
      </div>

      {/* Trophy display */}
      <div className="relative z-10 h-64 flex items-center justify-center">
        <div className="absolute bottom-6 h-6 w-56 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${role.accent}88, transparent)`, filter: "blur(6px)" }} />
        <img
          src={TROPHY[role.slug]}
          alt={`${role.name} luxury trophy`}
          className={`h-56 w-56 object-contain trophy-float ${pulse ? "trophy-unlock" : ""}`}
          style={{ filter: `drop-shadow(0 12px 30px ${role.accent}88)` }}
        />
        <MuseumCase accent={role.accent} />
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <SVSeal accent={role.accent} size={22} />
          <SVMicroMark accent={role.accent} />
        </div>
        <div
          className="absolute bottom-2 right-3 z-10 font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.22em", color: `${role.accent}aa` }}
        >
          {svCollectionNumber(`${role.slug}-${tier.key}`, role.passportPrefix)}
        </div>
      </div>

      {/* engraved nameplate */}
      <div className="relative z-10 mx-5 mb-3 rounded-md border overflow-hidden"
        style={{ borderColor: `${role.accent}66`, background: `linear-gradient(180deg, ${role.accent}22, transparent 60%, ${role.accent}18)` }}>
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${role.accent}, ${tier.hue})` }} />
        <div className="px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${role.accent}cc` }}>Engraved</div>
          <div className="mt-0.5 text-sm text-white font-medium tracking-wide">{tier.label}</div>
          <div className="text-[10px] text-white/60 italic">"{role.motto}"</div>
        </div>
      </div>

      {/* tier selector */}
      <div className="relative z-10 px-5 pb-3">
        <div className="flex gap-1.5 flex-wrap">
          {role.trophies.map((t, i) => (
            <button
              key={t.key}
              onClick={() => setTierIdx(i)}
              className="text-[10px] font-mono px-2 py-1 rounded-full transition"
              style={{
                background: i === tierIdx ? t.hue : "transparent",
                color: i === tierIdx ? "#0a0a0a" : t.hue,
                border: `1px solid ${t.hue}77`,
              }}
            >
              {t.key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 px-5 pb-4 grid grid-cols-2 gap-2 text-[10px] text-white/70">
        <div><span className="uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>Material</span><div className="mt-0.5">{theme.material}</div></div>
        <div><span className="uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>Silhouette</span><div className="mt-0.5">{theme.shape}</div></div>
      </div>

      <div className="relative z-10 border-t px-5 py-3 flex items-center justify-between"
        style={{ borderColor: `${role.accent}33`, background: "rgba(0,0,0,0.35)" }}>
        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
          <Trophy className="h-3.5 w-3.5" style={{ color: role.accent }} />
          {role.awardStyle}
        </div>
        <button onClick={play}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition hover:brightness-110"
          style={{ background: `linear-gradient(135deg, ${role.accent}, ${tier.hue})`, color: "#0a0a0a", boxShadow: `0 0 22px -6px ${role.accent}` }}>
          <Volume2 className="h-3.5 w-3.5" /> Ceremony
        </button>
      </div>
    </article>
  );
}
