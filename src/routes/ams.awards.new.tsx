import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { AwardForm } from "@/components/ams/AwardForm";

export const Route = createFileRoute("/ams/awards/new")({
  head: () => ({
    meta: [
      { title: "New Award — AMS" },
      { name: "description", content: "Define the basics, attach media, set unlock rules and rewards, then publish." },
      { property: "og:title", content: "New Award — AMS" },
      { property: "og:description", content: "Define the basics, attach media, set unlock rules and rewards, then publish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewAwardPage,
});

function NewAwardPage() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 mb-2 -ml-2"><Link to="/ams/awards"><ChevronLeft className="h-4 w-4" /> Back to awards</Link></Button>
        <PageHeader kicker="Create" title="New award" description="Define the basics, attach media, set unlock rules and rewards, then publish." />
      </div>
      <AwardForm mode="create" />
    </div>
  );
}
