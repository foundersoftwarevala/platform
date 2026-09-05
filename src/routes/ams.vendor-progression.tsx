import { createFileRoute } from "@tanstack/react-router";
import { VENDOR_STAGES } from "@/lib/ams/vendor-stages";
import { ProgressionTimeline } from "@/components/ams/progression/ProgressionTimeline";

export const Route = createFileRoute("/ams/vendor-progression")({
  head: () => ({
    meta: [
      { title: "Vendor Progression — 10 Stage Career" },
      { name: "description", content: "A cinematic 10-stage vendor career: from First Listing to Founding Vendor. Every stage unlocks a unique storefront, passport, trophy, medal and certificate." },
      { property: "og:title", content: "Vendor Progression — 10 Stage Career" },
      { property: "og:description", content: "Stage-by-stage timeline for the Vendor role, with unlock celebrations and premium sound cues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ProgressionTimeline
      stages={VENDOR_STAGES}
      role="Vendor"
      kicker="Master Role Progression · Vendor"
      title="Vendor — Ten Stages of a Storefront"
      description="From the first listing to the founding marketplace. Each stage changes the material, storefront motif, ribbon, nameplate and unlock ceremony."
    />
  );
}
