import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_IDENTITY_CARD } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/identity-card-vault")({
  head: () => ({
    meta: [
      { title: "Identity Card Vault — Premium 3D Cards" },
      { name: "description", content: "Luxury metallic identity cards, one per role." },
      { property: "og:title", content: "Identity Card Vault — Premium 3D Cards" },
      { property: "og:description", content: "11 handcrafted identity cards with embossed crests and holographic strips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Identity Card Vault"
      title="Premium 3D Identity Cards"
      description="Luxury metallic identity cards with embossed crests, holographic strips and chip contacts."
      suffix="identity-card"
      singular="Identity Card"
      assets={ROLE_IDENTITY_CARD}
      unlockKind="badge"
    />
  ),
});
