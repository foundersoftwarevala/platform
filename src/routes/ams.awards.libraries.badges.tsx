import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/ams/shared/LibraryPage";

export const Route = createFileRoute("/ams/awards/libraries/badges")({
  head: () => ({
    meta: [
      { title: "Badge Library — AMS" },
      { name: "description", content: "Identity markers awarded for skills, milestones and contributions." },
      { property: "og:title", content: "Badge Library — AMS" },
      { property: "og:description", content: "Identity markers awarded for skills, milestones and contributions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LibraryPage type="badge" kicker="Library" title="Badges" description="Identity markers awarded for skills, milestones and contributions." />,
});
