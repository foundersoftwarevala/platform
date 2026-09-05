import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { AmsManagerPanel } from "@/components/command-center/AmsManagerPanel";

export const Route = createFileRoute("/ams-manager")({
  head: () => ({
    meta: [
      { title: "AMS Manager — Software Vala Control Panel" },
      {
        name: "description",
        content: "Achievement management, progression, leaderboard and rewards analytics from one control panel.",
      },
      { property: "og:title", content: "AMS Manager — Software Vala" },
      {
        property: "og:description",
        content: "Manage rewards, progression, achievements and engagement across the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="creator-theme min-h-screen">
      <PageShell>
        <AmsManagerPanel />
      </PageShell>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="creator-theme min-h-screen">
      <PageShell>
        <div className="bento-card py-16 text-center">
          <h2 className="text-lg font-semibold">AMS Manager unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </PageShell>
    </div>
  ),
});
