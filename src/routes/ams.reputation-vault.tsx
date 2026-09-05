import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_REPUTATION } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/reputation-vault")({
  head: () => ({
    meta: [
      { title: "Reputation Vault — Premium 3D Medals" },
      { name: "description", content: "Museum-quality 3D reputation medals, one per role." },
      { property: "og:title", content: "Reputation Vault — Premium 3D Medals" },
      { property: "og:description", content: "11 handcrafted reputation medals with laurel wreaths and role motifs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Reputation Vault"
      title="Premium 3D Reputation Medals"
      description="Titanium and gold reputation medals, one per role, hand-engraved with laurel wreath and role motif."
      suffix="reputation-medal"
      singular="Reputation Medal"
      assets={ROLE_REPUTATION}
      unlockKind="achievement"
    />
  ),
});
