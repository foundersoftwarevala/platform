import { createFileRoute, Link } from "@tanstack/react-router";
import { ROLES } from "@/lib/ams/roles";
import { ROLE_THEMES } from "@/lib/ams/role-themes";
import { RolePattern } from "@/components/ams/showcase/RolePattern";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/ams/role-showcase/")({
  head: () => ({
    meta: [
      { title: "Role Showcase — Sovereign Rooms" },
      { name: "description", content: "Immersive per-role showcase rooms: unique cover, avatar, passport, trophy, medal, badge, award, certificate and cabinet for every profession." },
      { property: "og:title", content: "Role Showcase — Sovereign Rooms" },
      { property: "og:description", content: "Immersive per-role showcase rooms: unique cover, avatar, passport, trophy, medal, badge, award, certificate and cabinet for every profession." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Sovereign Wing</div>
        <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Role Showcase Rooms</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Every profession, its own handcrafted world. Enter a room to see the full identity —
          cover banner, avatar frame, membership card, digital passport, trophies, medals,
          badges, award plates, certificates and collection cabinet.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ROLES.map((role) => {
          const t = ROLE_THEMES[role.slug];
          return (
            <Link
              key={role.slug}
              to="/role-showcase/$slug"
              params={{ slug: role.slug }}
              className="group relative aspect-[4/5] rounded-2xl border overflow-hidden transition hover:brightness-110"
              style={{
                background: t.environment,
                borderColor: `${t.primary}55`,
                boxShadow: `0 30px 60px -30px ${t.glow}`,
              }}
            >
              <RolePattern kind={t.pattern} color={t.primary} id={`portal-${t.slug}`}
                className="absolute inset-0 h-full w-full" opacity={0.16} />
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div className="flex items-start justify-between">
                  <div className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: `${t.primary}bb` }}>
                    {role.passportPrefix}
                  </div>
                  <span className="text-3xl" style={{ color: t.primary, fontFamily: t.displayFont, textShadow: `0 0 24px ${t.glow}` }}>
                    {t.glyphIcon}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase" style={{ color: `${t.accent}bb` }}>
                    {t.environmentLabel}
                  </div>
                  <div className="mt-1 text-2xl text-white" style={{ fontFamily: t.displayFont }}>{role.name}</div>
                  <div className="text-[11px] mt-0.5 italic text-white/60">"{role.motto}"</div>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium"
                    style={{ color: t.primary }}>
                    Enter room <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
