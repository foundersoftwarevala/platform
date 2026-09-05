import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_BADGE } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/badge-vault")({
  head: () => ({
    meta: [
      { title: "Badge Vault — Premium 3D Badges" },
      { name: "description", content: "Enamel-and-metal 3D role badges with rotation and PNG export." },
      { property: "og:title", content: "Badge Vault — Premium 3D Badges" },
      { property: "og:description", content: "11 role badges with hard enamel inlays and brushed metal frames." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Badge Vault"
      title="Premium 3D Badge Collection"
      description="Hard-enamel role badges set in brushed metal frames with engraved profession motifs."
      suffix="badge"
      singular="Badge"
      assets={ROLE_BADGE}
      unlockKind="badge"
    />
  ),
});
