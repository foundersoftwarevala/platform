import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { Collectible3D } from "@/components/ams/collectible/Collectible3D";
import { RoleFilter, type RoleFilterValue } from "@/components/ams/collectible/RoleFilter";
import { VaultToolbar } from "@/components/ams/collectible/VaultToolbar";
import { CertificateQR } from "@/components/ams/collectible/CertificateQR";
import { ROLE_CERTIFICATE } from "@/lib/ams/role-assets";
import { certificateIdentity } from "@/lib/ams/certificate-id";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/certificate-vault")({
  head: () => ({
    meta: [
      { title: "Certificate Vault — Premium 3D Certificates" },
      { name: "description", content: "Foil-embossed 3D role certificates with certificate numbers, scannable QR verification, rotation and PNG export." },
      { property: "og:title", content: "Certificate Vault — Premium 3D Certificates" },
      { property: "og:description", content: "Role certificates with gold foil borders, wax seals, guilloché detail and registry-verified QR codes." },
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
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold text-foreground">Premium 3D Certificate Collection</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Foil-embossed certificates with guilloché borders, wax seals and role-specific crests.
            Every certificate carries its own registry number and scannable QR verification.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScrollText className="h-4 w-4 text-amber-400" />
          <span>{ROLES.length} certificates · {visible.length} shown</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={setFilter} />
        <VaultToolbar items={exportItems} accent="#facc15" exportLabel="Export certificate set" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => {
          const identity = certificateIdentity(role);
          return (
            <article key={role.slug} className="rounded-2xl border border-border/60 bg-black/20 overflow-hidden">
              <Collectible3D
                src={ROLE_CERTIFICATE[role.slug]}
                filename={`${role.slug}-certificate.png`}
                accent={role.accent}
                label={`${identity.number} · Certificate`}
                height={340}
                showUnlock
                unlockKind="achievement"
                unlockTitle={`${role.name} Certificate Issued`}
                unlockSubtitle={identity.title}
              />
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-lg font-semibold text-white">{role.name}</div>
                  <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                    {identity.title}
                  </div>
                  <p className="mt-2 text-xs text-white/60 font-mono">
                    No. {identity.number} · Issued {identity.issued}
                  </p>
                </div>
                <CertificateQR role={role} size={104} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
