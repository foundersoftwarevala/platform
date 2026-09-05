import { createFileRoute } from "@tanstack/react-router";
import { AUTHOR_STAGES } from "@/lib/ams/author-stages";
import { ProgressionTimeline } from "@/components/ams/progression/ProgressionTimeline";

export const Route = createFileRoute("/ams/author-progression")({
  head: () => ({
    meta: [
      { title: "Author Progression — 10 Stage Career" },
      { name: "description", content: "A cinematic 10-stage author career: from First Draft to Founding Author. Every stage unlocks a unique passport, trophy, medal, badge and certificate." },
      { property: "og:title", content: "Author Progression — 10 Stage Career" },
      { property: "og:description", content: "Stage-by-stage timeline for the Author role, with unlock celebrations and premium sound cues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ProgressionTimeline
      stages={AUTHOR_STAGES}
      role="Author"
      kicker="Master Role Progression · Author"
      title="Author — Ten Chapters of a Career"
      description="From the first draft to the founding shelf. Each stage rewrites the material, cover motif, ribbon, nameplate and unlock ceremony."
    />
  );
}
