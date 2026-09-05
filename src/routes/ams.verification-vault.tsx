import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { ROLES } from "@/lib/ams/roles";
import { ROLE_SHIELD } from "@/lib/ams/role-assets";
import { Collectible3D } from "@/components/ams/collectible/Collectible3D";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";

export const Route = createFileRoute("/ams/verification-vault")({
  head: () => ({
    meta: [
      { title: "Verification Vault — Premium 3D Trust Shields" },
      { name: "description", content: "Museum-quality 3D verification shields, one per role — animated lighting, rotating preview and PNG export." },
      { property: "og:title", content: "Verification Vault — Premium 3D Trust Shields" },
      { property: "og:description", content: "11 handcrafted verification shields with unique profession cues, engraved approval marks and luxury materials." },
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
    () => visible.map((r) => ({ src: ROLE_SHIELD[r.slug], filename: `${r.slug}-verification-shield.png` })),
    [visible],
  );


  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Verification Vault</div>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Premium 3D Trust Shields</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Profession-specific verification collectibles with premium shield geometry, engraved trust marks,
            luxury finishes and approval stamps. Rotate, inspect and export every shield as PNG.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} shields · {visible.length} shown</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={setFilter} />
        <VaultToolbar items={exportItems} accent="#38bdf8" exportLabel="Export shield set" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => {
          const img = ROLE_SHIELD[role.slug];
          return (
            <article
              key={role.slug}
              className="rounded-2xl border border-border/60 bg-black/20 overflow-hidden"
            >
              <Collectible3D
                src={img}
                filename={`${role.slug}-verification-shield.png`}
                accent={role.accent}
                label={`${role.passportPrefix} · Verified`}
                height={340}
                showUnlock
                unlockKind="surprise"
                unlockTitle={`${role.name} Verification Granted`}
                unlockSubtitle={role.motto}
              />
              <div className="p-4">
                <div className="text-lg font-semibold text-white">{role.name}</div>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                  {role.archetype} · Verification Shield
                </div>
                <p className="mt-2 text-xs text-white/70 italic">&quot;{role.motto}&quot;</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
