import { createFileRoute } from "@tanstack/react-router";
import { CollectibleVault } from "@/components/ams/collectible/CollectibleVault";
import { ROLE_TRUST_SEAL } from "@/lib/ams/role-assets";

export const Route = createFileRoute("/ams/trust-seal-vault")({
  head: () => ({
    meta: [
      { title: "Trust Seal Vault — Premium 3D Wax Seals" },
      { name: "description", content: "Heavy wax-stamped trust seals, one per role." },
      { property: "og:title", content: "Trust Seal Vault — Premium 3D Wax Seals" },
      { property: "og:description", content: "11 hand-embossed trust seals with role crests and silk ribbons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CollectibleVault
      kicker="Trust Seal Vault"
      title="Premium 3D Trust Seals"
      description="Heavy embossed wax seals with role crests and silk ribbons — a signature of authenticity."
      suffix="trust-seal"
      singular="Trust Seal"
      assets={ROLE_TRUST_SEAL}
      unlockKind="badge"
    />
  ),
});
