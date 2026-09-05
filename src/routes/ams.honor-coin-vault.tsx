import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_HONOR_COIN } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/honor-coin-vault")({
  head: () => ({
    meta: [
      { title: "Honor Coin Vault — Premium 3D Challenge Coins" },
      { name: "description", content: "Thick antique brass honor coins, one per role." },
      { property: "og:title", content: "Honor Coin Vault — Premium 3D Challenge Coins" },
      { property: "og:description", content: "11 heavy relief honor coins with enamel inlays and engraved rims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Honor Coin Vault"
      title="Premium 3D Honor Coins"
      description="Thick antique brass challenge coins with high-relief crests and enamel inlays."
      suffix="honor-coin"
      singular="Honor Coin"
      assets={ROLE_HONOR_COIN}
      unlockKind="trophy"
    />
  ),
});
