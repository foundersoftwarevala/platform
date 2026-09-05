import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { SHOWCASES, ROLE_ENVIRONMENT } from "@/lib/ams/museum";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/museum/")({
  head: () => ({
    meta: [
      { title: "Presentation Engine — Software Vala Museums" },
      { name: "description", content: "Fourteen luxury showcases — trophy museum, award gallery, certificate hall and more — each with glass cabinets, spotlights and cinematic 3D preview." },
      { property: "og:title", content: "Presentation Engine — Software Vala Museums" },
      { property: "og:description", content: "Experience every collectible inside a world-class digital museum with museum, showcase, carousel and comparison display modes." },
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
          Software Vala · Master Presentation Engine
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-foreground lg:text-4xl">Museums &amp; Galleries</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every collectible presented as a real luxury object: glass cabinets, floating platforms,
          spotlights, reflection floors and cinematic camera work — one immersive environment per role.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHOWCASES.map((s) => (
          <Link
            key={s.slug}
            to="/museum/$showcase"
            params={{ showcase: s.slug }}
            className="group rounded-2xl border border-border/60 bg-black/20 p-4 motion-card"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: `${s.accent}cc` }}>
                {s.kicker}
              </span>
              <Landmark className="h-4 w-4" style={{ color: s.accent }} />
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{s.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              <span>{s.collectionStyle}</span>
              <span>{ROLES.length} roles</span>
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Role Immersion Environments
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const env = ROLE_ENVIRONMENT[r.slug];
            return (
              <div key={r.slug} className="rounded-xl border border-border/60 p-3"
                style={{ background: env.backdrop, borderColor: `${r.accent}44` }}>
                <div className="text-sm font-semibold text-foreground">{r.glyph} {r.name}</div>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: `${r.accent}bb` }}>{env.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">{env.vibe}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
