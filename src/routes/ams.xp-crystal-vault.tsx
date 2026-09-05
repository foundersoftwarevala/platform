import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_XP_CRYSTAL } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/xp-crystal-vault")({
  head: () => ({
    meta: [
      { title: "XP Crystal Vault — Premium 3D Crystals" },
      { name: "description", content: "Faceted glowing XP crystals, one per role." },
      { property: "og:title", content: "XP Crystal Vault — Premium 3D Crystals" },
      { property: "og:description", content: "11 faceted role crystals with internal glow and caustic motifs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="XP Crystal Vault"
      title="Premium 3D XP Crystals"
      description="Faceted glowing crystal shards refracting each role's signature light and motif."
      suffix="xp-crystal"
      singular="XP Crystal"
      assets={ROLE_XP_CRYSTAL}
      unlockKind="trophy"
    />
  ),
});
