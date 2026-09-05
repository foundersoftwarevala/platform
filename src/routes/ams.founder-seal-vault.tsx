import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_FOUNDER_SEAL } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/founder-seal-vault")({
  head: () => ({
    meta: [
      { title: "Founder Seal Vault — Premium 3D Founder Seals" },
      { name: "description", content: "Heavy embossed founder wax seals, one per role." },
      { property: "og:title", content: "Founder Seal Vault — Premium 3D Founder Seals" },
      { property: "og:description", content: "11 founder wax seals with dripping wax and brass crest imprints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Founder Seal Vault"
      title="Premium 3D Founder Seals"
      description="Heavy dripping wax seals with brass crest imprints — reserved for founding contributors."
      suffix="founder-seal"
      singular="Founder Seal"
      assets={ROLE_FOUNDER_SEAL}
      unlockKind="achievement"
    />
  ),
});
