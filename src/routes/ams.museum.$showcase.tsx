import { createFileRoute, Link } from "@tanstack/react-router";
import { MuseumShowcase } from "@/components/ams/museum/MuseumShowcase";
import { getShowcase, SHOWCASES } from "@/lib/ams/museum";

export const Route = createFileRoute("/ams/museum/$showcase")({
  head: ({ params }) => {
    const s = getShowcase(params.showcase);
    const title = s ? `${s.title} — Software Vala Museum` : "Showcase Unavailable";
    const description = s?.description ?? "This showcase is not part of the presentation engine.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(s ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: Page,
});

function Page() {
  const { showcase } = Route.useParams();
  const def = getShowcase(showcase);

  if (!def) {
    return (
      <div className="space-y-4 p-6 lg:p-8">
        <h1 className="text-2xl font-semibold text-foreground">Showcase not found</h1>
        <p className="text-sm text-muted-foreground">Choose one of the {SHOWCASES.length} museums below.</p>
        <div className="flex flex-wrap gap-2">
          {SHOWCASES.map((s) => (
            <Link key={s.slug} to="/museum/$showcase" params={{ showcase: s.slug }}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              {s.title}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return <MuseumShowcase showcase={def} />;
}
