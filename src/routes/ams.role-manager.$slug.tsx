import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronLeft, Sparkles, Trophy, Award, ShieldCheck, BookOpen, Compass,
  Star, Route as RouteIcon, Layers, Quote, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRole, type RoleDNA } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/role-manager/$slug")({
  head: ({ params }) => {
    const title = `${params.slug} — Role DNA`;
    const description = `Complete role DNA for ${params.slug}: archetype, motto, progression path, collectibles and recognition rules inside AMS.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: ({ params }) => {
    const role = getRole(params.slug);
    if (!role) throw notFound();
    return { role };
  },
  notFoundComponent: NotFound,
  component: Page,
});

function NotFound() {
  return (
    <div className="p-12 text-center">
      <h1 className="text-2xl font-bold">Role not found</h1>
      <Button asChild variant="outline" className="mt-4"><Link to="/ams/role-manager">Back to Role Manager</Link></Button>
    </div>
  );
}

function Section({ icon: Icon, title, kicker, children }: { icon: React.ComponentType<{ className?: string }>; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center"><Icon className="h-4 w-4" /></div>
        <div>
          {kicker && <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{kicker}</div>}
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function Chip({ children, hue }: { children: React.ReactNode; hue?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
      style={{ borderColor: hue ? `${hue}55` : undefined, color: hue, background: hue ? `${hue}12` : undefined }}
    >
      {children}
    </span>
  );
}

function Page() {
  const { role } = Route.useLoaderData() as { role: RoleDNA };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <Link to="/ams/role-manager"><ChevronLeft className="h-4 w-4" /> Back to Role Manager</Link>
      </Button>

      {/* Hero */}
      <header
        className="surface-card overflow-hidden relative p-8"
        style={{ background: `radial-gradient(1200px 300px at 10% -20%, ${role.accent}22, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Role DNA · {role.archetype}</div>
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: role.accent }}>
              <span className="mr-3">{role.glyph}</span>{role.name}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl italic">"{role.motto}"</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {role.behavior.map((b) => <Chip key={b} hue={role.accent}>{b}</Chip>)}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Passport Prefix</div>
            <div className="font-mono text-lg" style={{ color: role.accent }}>{role.passportPrefix}-00001</div>
            <Badge variant="outline" className="mt-1">{role.passport.verification}</Badge>
          </div>
        </div>
      </header>

      {/* Personality */}
      <Section icon={Quote} kicker="Personality" title="Voice, tone and philosophy">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {[
            ["Vision", role.vision], ["Mission", role.mission], ["Philosophy", role.philosophy],
            ["Signature", role.signature], ["Greeting", role.greeting], ["Welcome", role.welcome],
            ["Congratulations", role.congratulations], ["Celebration", role.celebration], ["Motivation", role.motivation],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k}</div>
              <div className="mt-1">{v}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Language & Success */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section icon={MessageCircle} kicker="Role Language" title="Domain terminology">
          <div className="flex flex-wrap gap-1.5">
            {role.language.map((t) => <Chip key={t} hue={role.accent}>{t}</Chip>)}
          </div>
        </Section>
        <Section icon={Sparkles} kicker="Success" title="What success means here">
          <p className="text-sm">{role.successDefinition}</p>
          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Career Path</div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            {role.careerPath.map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span className="rounded border border-border/60 bg-muted/20 px-1.5 py-0.5">{c}</span>
                {i < role.careerPath.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* Trophies */}
      <Section icon={Trophy} kicker={role.trophyStyle} title="Trophy Tiers">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {role.trophies.map((t) => (
            <div
              key={t.key}
              className="rounded-xl border p-4 text-center space-y-2 relative overflow-hidden"
              style={{ borderColor: `${t.hue}44`, background: `linear-gradient(180deg, ${t.hue}18, transparent)` }}
            >
              <Trophy className="h-6 w-6 mx-auto" style={{ color: t.hue }} />
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{t.key}</div>
              <div className="text-xs font-semibold" style={{ color: t.hue }}>{t.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Awards + Badges */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section icon={Award} kicker={role.awardStyle} title="Signature Awards">
          <ul className="space-y-2 text-sm">
            {role.awardExamples.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5" style={{ color: role.accent }} />{a}
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={ShieldCheck} kicker="Badges" title="Verification & Prestige Badges">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {role.badges.map((b) => (
              <div key={b.key} className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.key}</div>
                <div className="mt-0.5 font-medium" style={{ color: role.accent }}>{b.label}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Certificates */}
      <Section icon={BookOpen} kicker="Certificates" title="Recognition Levels">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {role.certificates.map((c) => (
            <div key={c.key} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.key}</div>
              <div className="mt-1 text-xs font-medium">{c.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Passport */}
      <Section icon={Compass} kicker="Passport" title="Role Passport">
        <div className="grid md:grid-cols-2 gap-4">
          <div
            className="rounded-2xl p-6 border relative overflow-hidden min-h-[200px]"
            style={{ borderColor: `${role.accent}55`, background: `linear-gradient(135deg, ${role.accent}22, transparent 70%), #0b0d12` }}
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Software Vala</div>
            <div className="text-2xl font-bold mt-1" style={{ color: role.accent }}>{role.name} Passport</div>
            <div className="mt-6 font-mono text-sm">{role.passportPrefix}-00001</div>
            <div className="mt-1 text-xs text-muted-foreground">{role.passport.cover}</div>
            <div className="absolute right-4 bottom-4 text-4xl opacity-60" style={{ color: role.accent }}>{role.glyph}</div>
          </div>
          <div className="space-y-3 text-sm">
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Stamp:</span> {role.passport.stamp}</div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Verification:</span> {role.passport.verification}</div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Timeline</div>
              <ol className="space-y-1">
                {role.passport.timeline.map((t, i) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: `${role.accent}22`, color: role.accent }}>{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Section>

      {/* Journey */}
      <Section icon={RouteIcon} kicker="Journey" title="From Starter to Legacy">
        <ol className="relative border-l border-border/60 ml-2 space-y-4">
          {role.journey.map((s, i) => (
            <li key={s.key} className="pl-4 relative">
              <span
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2"
                style={{ background: role.accent, borderColor: `${role.accent}66` }}
              />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Stage {i + 1}</span>
                <span className="font-semibold text-sm" style={{ color: role.accent }}>{s.label}</span>
              </div>
              <div className="text-sm text-muted-foreground">{s.narrative}</div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Reputation + Collections + Legacy */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section icon={Star} kicker="Reputation" title="Trust Pillars">
          <ul className="space-y-1.5 text-sm">
            {role.reputationPillars.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: role.accent }} />{p}
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={Layers} kicker="Collections" title="Role Collections">
          <ul className="space-y-1.5 text-sm">
            {role.collections.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: role.accent }} />{c}
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={Trophy} kicker="Legacy" title="The Line You Leave">
          <p className="text-sm italic" style={{ color: role.accent }}>{role.legacyLine}</p>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Digital Museum · Hall of Fame · Lifetime Journey</div>
        </Section>
      </div>
    </div>
  );
}
