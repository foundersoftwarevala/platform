import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_RECOGNITION_COIN } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/recognition-coin-vault")({
  head: () => ({
    meta: [
      { title: "Recognition Coin Vault — Premium 3D Coins" },
      { name: "description", content: "Thick minted collector coins, one per role." },
      { property: "og:title", content: "Recognition Coin Vault — Premium 3D Coins" },
      { property: "og:description", content: "11 heavy engraved recognition coins with milled edges and role crests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Recognition Coin Vault"
      title="Premium 3D Recognition Coins"
      description="Thick minted collector coins with role-specific engravings, milled edges and cinematic lighting."
      suffix="recognition-coin"
      singular="Recognition Coin"
      assets={ROLE_RECOGNITION_COIN}
      unlockKind="trophy"
    />
  ),
});
