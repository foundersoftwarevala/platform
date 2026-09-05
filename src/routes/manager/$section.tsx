import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ScreenRenderer } from "@/components/manager/registry";
import { findGroup } from "@/lib/manager-nav";

const searchSchema = z.object({
  view: z.string().optional(),
});

export const Route = createFileRoute("/manager/$section")({
  validateSearch: searchSchema,
  head: ({ params }) => {
    const group = findGroup(params.section);
    const title = `${group?.label ?? "AI API Manager"} · Software Vala`;
    const description = `${group?.label ?? "AI API Manager"} console for Software Vala — live API, AI model, billing and security operations.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SectionRoute,
});

function SectionRoute() {
  const { section } = Route.useParams();
  const { view } = Route.useSearch();
  return <ScreenRenderer section={section} view={view} />;
}
