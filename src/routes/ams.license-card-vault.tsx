import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_LICENSE_CARD } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/license-card-vault")({
  head: () => ({
    meta: [
      { title: "License Card Vault — Premium 3D Credentials" },
      { name: "description", content: "Official-looking license cards, one per role." },
      { property: "og:title", content: "License Card Vault — Premium 3D Credentials" },
      { property: "og:description", content: "11 embossed professional license cards with holograms and guilloché." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="License Card Vault"
      title="Premium 3D License Cards"
      description="Embossed professional license cards with holograms, guilloché patterns and role crests."
      suffix="license-card"
      singular="License Card"
      assets={ROLE_LICENSE_CARD}
      unlockKind="badge"
    />
  ),
});
