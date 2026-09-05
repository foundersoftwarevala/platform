import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { listAwards } from "@/lib/ams/awards.api";
import { AWARD_CATEGORIES } from "@/lib/ams/types";

export const Route = createFileRoute("/ams/awards/categories")({
  head: () => ({
    meta: [
      { title: "Award Categories — AMS" },
      { name: "description", content: "Awards are grouped by category. Each category controls visibility scope and audience defaults across the Software Vala ecosystem." },
      { property: "og:title", content: "Award Categories — AMS" },
      { property: "og:description", content: "Awards are grouped by category. Each category controls visibility scope and audience defaults across the Software Vala ecosystem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data } = useQuery({ queryKey: ["awards", "_all_for_categories"], queryFn: () => listAwards({}) });
  const counts = new Map<string, number>();
  (data?.rows ?? []).forEach((a) => counts.set(a.category, (counts.get(a.category) ?? 0) + 1));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker="Award Management"
        title="Categories"
        description="Awards are grouped by category. Each category controls visibility scope and audience defaults across the Software Vala ecosystem."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {AWARD_CATEGORIES.map((c) => (
          <Link
            key={c.value}
            to="/ams/awards"
            className="surface-card p-4 flex items-center justify-between hover:shadow-glow-trophy transition-shadow"
          >
            <div>
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{counts.get(c.value) ?? 0} award{(counts.get(c.value) ?? 0) === 1 ? "" : "s"}</div>
            </div>
            <div className="text-2xl font-display text-gradient-trophy">{counts.get(c.value) ?? 0}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
