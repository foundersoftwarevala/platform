import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Volume2 } from "lucide-react";
import { ROLES, type RoleSlug } from "@/lib/ams/roles";
import { ROLE_THEMES } from "@/lib/ams/role-themes";
import { RolePattern } from "@/components/ams/showcase/RolePattern";
import {
  MembershipCard, Passport, Medal, Badge, AwardPlate,
  Certificate, TrophyCabinet, AvatarFrame,
} from "@/components/ams/showcase/atoms";
import { StageTrophy } from "@/components/ams/trophy-gallery/StageTrophy";
import { playUnlock, type UnlockPreset } from "@/lib/ams/trophy-sounds";

export const Route = createFileRoute("/ams/role-showcase/$slug")({
  head: ({ params }) => {
    const role = ROLES.find((r) => r.slug === params.slug);
    return {
      meta: [
        { title: role ? `${role.name} — Sovereign Room` : "Role Showcase" },
        { name: "description", content: role ? `Immersive showcase for the ${role.name} identity: cover, avatar, passport, trophy, medal, badge, certificate.` : "Role showcase room." },
        { property: "og:title", content: role ? `${role.name} — Sovereign Room` : "Role Showcase" },
        { property: "og:description", content: role ? `Immersive showcase for the ${role.name} identity: cover, avatar, passport, trophy, medal, badge, certificate.` : "Role showcase room." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Page,
});

const TIER_UNLOCK: Record<string, UnlockPreset> = {
  bronze: "bronze", silver: "silver", gold: "gold", diamond: "diamond",
  elite: "elite", legend: "legend", founder: "founder",
};

function Page() {
  const { slug } = Route.useParams();
  const role = ROLES.find((r) => r.slug === (slug as RoleSlug));
  if (!role) throw notFound();
  const t = ROLE_THEMES[role.slug];
  const [tierIdx, setTierIdx] = useState(role.trophies.length - 1);
  const tier = role.trophies[tierIdx];

  function ceremony() {
    playUnlock(TIER_UNLOCK[tier.key] ?? "gold");
  }

  const holderName = `Sovereign of the ${t.environmentLabel}`;
  const holderId = `${role.passportPrefix}-${String(1000 + tierIdx * 137).padStart(4, "0")}`;

  return (
    <div style={{ background: t.environment, fontFamily: t.bodyFont }} className="min-h-full">
      {/* ───────────────── Hero Cover ───────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: t.cover }} />
        <RolePattern kind={t.pattern} color={t.primary} id={`hero-${t.slug}`}
          className="absolute inset-0 h-full w-full" opacity={0.22} />
        {/* volumetric light */}
        <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${t.primary}55, transparent)`, filter: "blur(20px)" }} />
        <div className="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${t.accent}55, transparent)`, filter: "blur(24px)" }} />

        <div className="relative px-6 lg:px-10 pt-6 pb-16">
          <Link to="/ams/role-showcase" className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition">
            <ArrowLeft className="h-3.5 w-3.5" /> All rooms
          </Link>

          <div className="mt-8 grid gap-8 md:grid-cols-[auto_1fr] items-end">
            <AvatarFrame theme={t} initials={role.name.slice(0, 2).toUpperCase()} />
            <div>
              <div className="text-[11px] tracking-[0.4em] uppercase" style={{ color: `${t.accent}cc` }}>
                {t.environmentLabel} · {role.archetype}
              </div>
              <h1 className="mt-2 text-4xl lg:text-5xl text-white leading-none" style={{ fontFamily: t.displayFont }}>
                {role.name}
              </h1>
              <p className="mt-3 text-sm text-white/70 max-w-2xl italic">"{role.motto}" — {role.vision}</p>
              {/* Rank ribbon */}
              <div className="mt-4 inline-flex items-center gap-3 rounded-full pl-1 pr-4 py-1 border"
                style={{ borderColor: `${t.primary}66`, background: `${t.primary}12` }}>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest"
                  style={{ background: t.metallic, color: t.ink }}>{tier.key}</span>
                <span className="text-[12px] text-white/85" style={{ fontFamily: t.displayFont }}>{tier.label}</span>
                <span className="text-[10px] font-mono" style={{ color: `${t.primary}bb` }}>{holderId}</span>
              </div>
            </div>
          </div>

          {/* tier selector */}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {role.trophies.map((r, i) => (
              <button key={r.key} onClick={() => setTierIdx(i)}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full transition"
                style={{
                  background: i === tierIdx ? r.hue : "transparent",
                  color: i === tierIdx ? t.ink : r.hue,
                  border: `1px solid ${r.hue}77`,
                }}>
                {r.key.toUpperCase()} · {r.label}
              </button>
            ))}
            <button onClick={ceremony}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{ background: `linear-gradient(135deg, ${t.primary}, ${tier.hue})`, color: t.ink, boxShadow: `0 0 22px -6px ${t.glow}` }}>
              <Volume2 className="h-3 w-3" /> {t.ceremony}
            </button>
          </div>
        </div>
      </section>

      <div className="px-6 lg:px-10 py-10 space-y-12">

        {/* ───────────────── Identity Row ───────────────── */}
        <Row theme={t} label="Identity" caption="Membership card · Digital passport · Verification seal">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-start">
            <MembershipCard theme={t} name={holderName} id={holderId} tier={tier.label} />
            <Passport theme={t} name={holderName} id={holderId} />
          </div>
        </Row>

        {/* ───────────────── Trophy Room ───────────────── */}
        <Row theme={t} label="Trophy" caption={`${role.trophyStyle} · ${tier.label}`}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 relative rounded-2xl border overflow-hidden aspect-square flex items-center justify-center"
              style={{
                borderColor: `${t.primary}55`,
                background: `radial-gradient(closest-side at 50% 30%, ${tier.hue}44, transparent 70%), ${t.paper}`,
                boxShadow: `inset 0 0 60px ${t.primary}22`,
              }}>
              {/* Glass cabinet frame */}
              <div className="absolute inset-4 rounded-xl border" style={{ borderColor: `${t.primary}44`, background: t.glassTint, backdropFilter: "blur(2px)" }} />
              {/* Spotlight */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full"
                style={{ background: `radial-gradient(closest-side, ${tier.hue}77, transparent)`, filter: "blur(10px)" }} />
              <div className="relative trophy-float" style={{ filter: `drop-shadow(0 20px 30px ${t.glow})` }}>
                <StageTrophy shape={t.trophyShape} accent={tier.hue} id={`sr-${t.slug}-${tierIdx}`} className="h-64 w-64" />
              </div>
              {/* Display base label */}
              <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-[0.3em] uppercase"
                style={{ color: `${tier.hue}dd`, fontFamily: t.displayFont }}>{tier.label}</div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <AwardPlate theme={t} title={role.awardExamples[Math.min(tierIdx, role.awardExamples.length - 1)]} subtitle={`Presented at the ${t.ceremony}`} />
              <div className="grid grid-cols-2 gap-3">
                {role.awardExamples.slice(0, 4).map((a) => (
                  <div key={a} className="rounded-lg border px-4 py-3 flex items-center gap-3"
                    style={{
                      borderColor: `${t.primary}33`, background: t.glassTint,
                    }}>
                    <div className="h-9 w-9 rounded-md flex items-center justify-center"
                      style={{ background: t.metallic, color: t.ink, fontFamily: t.displayFont }}>{t.glyphIcon}</div>
                    <div>
                      <div className="text-[9px] uppercase tracking-widest" style={{ color: `${t.primary}bb` }}>Award</div>
                      <div className="text-sm text-white/90" style={{ fontFamily: t.displayFont }}>{a}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Row>

        {/* ───────────────── Medals & Badges ───────────────── */}
        <Row theme={t} label="Medals & Badges" caption="Ribbons · Metals · Engravings">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border p-6"
              style={{ borderColor: `${t.primary}44`, background: t.glassTint }}>
              <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: `${t.primary}bb` }}>Medal Case</div>
              <div className="flex flex-wrap gap-6 justify-center">
                {role.trophies.slice(0, 5).map((tt) => (
                  <Medal key={tt.key} theme={{ ...t, ribbon: [tt.hue, t.ink] as [string, string] }} label={tt.key} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border p-6"
              style={{ borderColor: `${t.primary}44`, background: t.glassTint }}>
              <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: `${t.primary}bb` }}>Badge Book</div>
              <div className="grid grid-cols-3 gap-4 justify-items-center">
                {role.badges.slice(0, 6).map((b) => (
                  <div key={b.key} className="flex flex-col items-center gap-1.5">
                    <Badge theme={t} label={b.key} />
                    <div className="text-[10px] text-white/70 text-center max-w-[8rem] leading-tight">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Row>

        {/* ───────────────── Certificate ───────────────── */}
        <Row theme={t} label="Certificate" caption="Gold foil · Official seal · QR verification">
          <div className="max-w-3xl">
            <Certificate theme={t}
              holder={holderName}
              title={role.certificates[Math.min(tierIdx, role.certificates.length - 1)].label} />
          </div>
        </Row>

        {/* ───────────────── Collection Cabinet ───────────────── */}
        <Row theme={t} label="Collection Cabinet" caption="Glass shelves · Ambient lighting · Slow rotation">
          <TrophyCabinet theme={t} tiers={role.trophies} />
        </Row>

        {/* ───────────────── Hall of Fame Wall ───────────────── */}
        <Row theme={t} label="Hall of Fame" caption="Legacy museum wall">
          <div className="relative rounded-2xl border overflow-hidden p-6"
            style={{ borderColor: `${t.primary}44`, background: `linear-gradient(180deg, ${t.paper}, ${t.ink})` }}>
            <RolePattern kind={t.pattern} color={t.primary} id={`hof-${t.slug}`}
              className="absolute inset-0 h-full w-full" opacity={0.08} />
            <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {role.trophies.map((tt, i) => (
                <div key={tt.key} className="rounded-xl border p-3 text-center"
                  style={{
                    borderColor: `${tt.hue}55`,
                    background: `radial-gradient(closest-side at 50% 20%, ${tt.hue}33, transparent 75%), ${t.glassTint}`,
                    boxShadow: `inset 0 0 20px ${tt.hue}22`,
                  }}>
                  <div className="mx-auto w-16">
                    <StageTrophy shape={t.trophyShape} accent={tt.hue} id={`hof-${t.slug}-${i}`} />
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: tt.hue }}>{tt.key}</div>
                  <div className="text-[11px] text-white/85 truncate" style={{ fontFamily: t.displayFont }}>{tt.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Row>

        {/* ───────────────── Reputation strip ───────────────── */}
        <Row theme={t} label="Reputation Pillars" caption={role.legacyLine}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {role.reputationPillars.map((p) => (
              <div key={p} className="rounded-lg border px-3 py-2 flex items-center gap-2 text-sm"
                style={{ borderColor: `${t.primary}33`, background: t.glassTint, color: "white" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.primary, boxShadow: `0 0 10px ${t.glow}` }} />
                <span style={{ fontFamily: t.bodyFont }}>{p}</span>
              </div>
            ))}
          </div>
        </Row>
      </div>
    </div>
  );
}

function Row({ theme, label, caption, children }: { theme: (typeof ROLE_THEMES)[RoleSlug]; label: string; caption?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${theme.primary}55, transparent)` }} />
        <div className="text-[10px] tracking-[0.4em] uppercase" style={{ color: `${theme.primary}dd`, fontFamily: theme.displayFont }}>{label}</div>
        <div className="h-px flex-[3]" style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}22)` }} />
      </div>
      {caption && <div className="mb-4 text-[11px] text-white/50 italic">{caption}</div>}
      {children}
    </section>
  );
}
