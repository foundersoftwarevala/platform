import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ribbon } from "lucide-react";
import { Collectible3D } from "@/components/ams/collectible/Collectible3D";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";
import { ROLE_CERTIFICATE } from "@/lib/ams/role-assets";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/certificates")({
  head: () => ({
    meta: [
      { title: "Certificate Vault — Premium 3D Certificates" },
      { name: "description", content: "Museum-quality 3D certificates, one per role — with 3D rotation, animated lighting and PNG export." },
      { property: "og:title", content: "Certificate Vault — Premium 3D Certificates" },
      { property: "og:description", content: "11 handcrafted role certificates with luxury materials, hologram strips, wax seals and QR verification." },
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
    () => visible.map((role) => ({ src: ROLE_CERTIFICATE[role.slug], filename: `${role.slug}-certificate.png` })),
    [visible],
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Certificate Vault</div>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Premium 3D Certificates</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Every role earns a handcrafted luxury certificate — foil borders, wax seals, holographic security
            strips and QR verification. Rotate, inspect and export as high-resolution PNG.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Ribbon className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} certificates · {visible.length} shown</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={setFilter} />
        <VaultToolbar items={exportItems} accent="#facc15" exportLabel="Export certificate set" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => {
          const img = ROLE_CERTIFICATE[role.slug];
          const topCert = role.certificates[role.certificates.length - 1]?.label ?? "Certificate";
          return (
            <article
              key={role.slug}
              className="rounded-2xl border border-border/60 bg-black/20 overflow-hidden"
            >
              <Collectible3D
                src={img}
                filename={`${role.slug}-certificate.png`}
                accent={role.accent}
                label={`${role.passportPrefix} · Certificate`}
                height={360}
                showUnlock
                unlockKind="achievement"
                unlockTitle={`${role.name} Certificate Issued`}
                unlockSubtitle={topCert}
              />
              <div className="p-4">
                <div className="text-lg font-semibold text-white">{role.name}</div>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                  {role.archetype} · {topCert}
                </div>
                <p className="mt-2 text-xs text-white/70 italic">"{role.awardStyle} — {role.motto}"</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

