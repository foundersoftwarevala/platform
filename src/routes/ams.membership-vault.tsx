import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { ROLES } from "@/lib/ams/roles";
import { ROLE_MEMBERSHIP } from "@/lib/ams/role-assets";
import { Collectible3D } from "@/components/ams/collectible/Collectible3D";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";

export const Route = createFileRoute("/ams/membership-vault")({
  head: () => ({
    meta: [
      { title: "Membership Vault — Premium 3D Member Cards" },
      { name: "description", content: "Museum-quality 3D membership cards, one per role — NFC chip, holographic strip, engraved emblem, 3D rotation and PNG export." },
      { property: "og:title", content: "Membership Vault — Premium 3D Member Cards" },
      { property: "og:description", content: "11 handcrafted role membership cards with luxury materials and unique emblems." },
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Membership Vault</div>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Premium 3D Membership Cards</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Every role earns a handcrafted metal-and-hologram membership card — NFC chip, holographic
            security strip, engraved role emblem and laser-etched serial. Rotate, inspect and export as PNG.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} cards · {visible.length} shown</span>
        </div>
      </header>

      <RoleFilter value={filter} onChange={setFilter} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => {
          const img = ROLE_MEMBERSHIP[role.slug];
          return (
            <article
              key={role.slug}
              className="rounded-2xl border border-border/60 bg-black/20 overflow-hidden"
            >
              <Collectible3D
                src={img}
                filename={`${role.slug}-membership.png`}
                accent={role.accent}
                label={`${role.passportPrefix} · Member`}
                height={340}
                showUnlock
                unlockKind="badge"
                unlockTitle={`${role.name} Membership Activated`}
                unlockSubtitle={role.motto}
              />
              <div className="p-4">
                <div className="text-lg font-semibold text-white">{role.name}</div>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                  {role.archetype} · Premium Member
                </div>
                <p className="mt-2 text-xs text-white/70 italic">"{role.motto}"</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
