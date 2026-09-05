import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_REWARD_CHEST } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/reward-chest-vault")({
  head: () => ({
    meta: [
      { title: "Reward Chest Vault — Premium 3D Chests" },
      { name: "description", content: "Ornate half-open reward chests, one per role." },
      { property: "og:title", content: "Reward Chest Vault — Premium 3D Chests" },
      { property: "og:description", content: "11 handcrafted reward chests with glowing spills and role motifs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Reward Chest Vault"
      title="Premium 3D Reward Chests"
      description="Ornate half-open chests spilling role-tinted light and treasures."
      suffix="reward-chest"
      singular="Reward Chest"
      assets={ROLE_REWARD_CHEST}
      unlockKind="trophy"
    />
  ),
});
