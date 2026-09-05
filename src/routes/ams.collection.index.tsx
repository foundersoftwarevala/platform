import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Gem } from "lucide-react";
import { CAREER_STAGES, COLLECTION_TYPES, RARITY_COLLECTIONS } from "@/lib/ams/signature-collection";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/collection/")({
  head: () => ({
    meta: [
      { title: "Signature Collections — Software Vala AMS" },
      { name: "description", content: "Career-long signature collections: ten stages per role across trophies, awards, badges, medals, passports, certificates and more." },
      { property: "og:title", content: "Signature Collections — Software Vala AMS" },
      { property: "og:description", content: "Build an entire professional career collection — 10 career-stage pieces per role, per collectible type." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400/80">
          Software Vala · Signature Engine
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-foreground lg:text-4xl">Signature Collections</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          AMS never shows a single item. Every role owns a {CAREER_STAGES.length}-stage collection per
          collectible type — Foundation through Founder Legacy — with unique silhouettes, bases, crowns,
          crystal cores, materials, edition and serial numbering.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400" />{ROLES.length} roles</span>
          <span className="inline-flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-amber-400/70" />
            {ROLES.length * CAREER_STAGES.length * COLLECTION_TYPES.length} collectible pieces
          </span>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTION_TYPES.map((t) => (
          <Link
            key={t.slug}
            to="/collection/$type"
            params={{ type: t.slug }}
            className="group rounded-2xl border border-border/60 bg-black/25 p-5 motion-card"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: `${t.accent}bb` }}>
              {t.kicker}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{t.title}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
            <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>{t.display}</span>
              <span style={{ color: t.accent }}>{CAREER_STAGES.length} stages →</span>
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Rarity collections</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {RARITY_COLLECTIONS.map((c) => (
            <span key={c} className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground">
              {c}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Career stages</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CAREER_STAGES.map((s, i) => (
            <div key={s.key} className="rounded-xl border border-border/60 bg-black/20 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                Stage {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: s.hue }}>{s.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{s.stage}</div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground/80">{s.material}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
