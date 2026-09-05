import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_TROPHY } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/trophy-vault")({
  head: () => ({
    meta: [
      { title: "Trophy Vault — Premium 3D Trophies" },
      { name: "description", content: "Museum-quality 3D trophies, one per role, with rotation and PNG export." },
      { property: "og:title", content: "Trophy Vault — Premium 3D Trophies" },
      { property: "og:description", content: "11 sculpted role trophies with premium bases and cinematic lighting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Trophy Vault"
      title="Premium 3D Trophy Collection"
      description="Sculpted role trophies with polished metal, glass accents and engraved marble bases."
      suffix="trophy"
      singular="Trophy"
      assets={ROLE_TROPHY}
      unlockKind="trophy"
    />
  ),
});
