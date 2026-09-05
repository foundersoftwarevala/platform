import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_HALL_OF_FAME } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/hall-of-fame-vault")({
  head: () => ({
    meta: [
      { title: "Hall of Fame Vault — Premium 3D Monuments" },
      { name: "description", content: "Monumental Hall of Fame emblems, one per role." },
      { property: "og:title", content: "Hall of Fame Vault — Premium 3D Monuments" },
      { property: "og:description", content: "11 monumental Hall of Fame plaques with laurel wreaths and role crests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Hall of Fame"
      title="Premium 3D Hall of Fame Emblems"
      description="Monumental engraved plaques with laurel wreaths and role crests — the highest honour."
      suffix="hall-of-fame"
      singular="Hall of Fame Emblem"
      assets={ROLE_HALL_OF_FAME}
      unlockKind="trophy"
    />
  ),
});
