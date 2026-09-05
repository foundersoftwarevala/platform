import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Collectible3D } from "@/components/ams/collectible/Collectible3D";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";
import { ROLE_ACHIEVEMENT } from "@/lib/ams/role-assets";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/achievement-vault")({
  head: () => ({
    meta: [
      { title: "Achievement Vault — Premium 3D Achievements" },
      { name: "description", content: "Museum-quality 3D achievement collectibles, one per role — with premium rotation, animated lighting and PNG export." },
      { property: "og:title", content: "Achievement Vault — Premium 3D Achievements" },
      { property: "og:description", content: "11 handcrafted role achievements with unique silhouettes, engraved motifs and collectible-grade finish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const [filter, setFilter] = useState<RoleFilterValue>("all");
  const visible = useMemo(
    () => (filter === "all" ? ROLES : ROLES.filter((r) => r.slug === filter)),
    [filter],
  );
  const exportItems = useMemo(
    () => visible.map((role) => ({ src: ROLE_ACHIEVEMENT[role.slug], filename: `${role.slug}-achievement.png` })),
    [visible],
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Achievement Vault</div>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Premium 3D Achievement Collection</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Each achievement collectible is built as a role-specific medallion — distinct silhouette,
            engraved profession cues, luxury finish and cinematic lighting. Rotate and export each one.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} achievements · {visible.length} shown</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={setFilter} />
        <VaultToolbar items={exportItems} accent="#facc15" exportLabel="Export achievement set" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => {
          const img = ROLE_ACHIEVEMENT[role.slug];
          return (
            <article key={role.slug} className="rounded-2xl border border-border/60 bg-black/20 overflow-hidden">
              <Collectible3D
                src={img}
                filename={`${role.slug}-achievement.png`}
                accent={role.accent}
                label={`${role.passportPrefix} · Achievement`}
                height={340}
                showUnlock
                unlockKind="trophy"
                unlockTitle={`${role.name} Achievement Unlocked`}
                unlockSubtitle={role.congratulations}
              />
              <div className="p-4">
                <div className="text-lg font-semibold text-white">{role.name}</div>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                  {role.archetype} · Achievement Core
                </div>
                <p className="mt-2 text-xs text-white/70 italic">"{role.motivation}"</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
