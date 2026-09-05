import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_LEGACY_MEDAL } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/legacy-medal-vault")({
  head: () => ({
    meta: [
      { title: "Legacy Medal Vault — Premium 3D Heirlooms" },
      { name: "description", content: "Aged bronze legacy medals on silk ribbons, one per role." },
      { property: "og:title", content: "Legacy Medal Vault — Premium 3D Heirlooms" },
      { property: "og:description", content: "11 heirloom legacy medals with role engravings and silk ribbons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Legacy Medal Vault"
      title="Premium 3D Legacy Medals"
      description="Aged bronze and gold heirloom medals hanging on silk ribbons — awarded for enduring contribution."
      suffix="legacy-medal"
      singular="Legacy Medal"
      assets={ROLE_LEGACY_MEDAL}
      unlockKind="achievement"
    />
  ),
});
