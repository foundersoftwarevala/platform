import { createFileRoute, notFound } from "@tanstack/react-router";
import { SignatureCollection } from "@/components/ams/collection/SignatureCollection";
import { getCollectionType } from "@/lib/ams/signature-collection";

export const Route = createFileRoute("/ams/collection/$type")({
  loader: ({ params }) => {
    const type = getCollectionType(params.type);
    if (!type) throw notFound();
    return { title: type.title, description: type.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Collection unavailable — Software Vala AMS" }, { name: "robots", content: "noindex" }] };
    }
    return {
      meta: [
        { title: `${loaderData.title} — Software Vala AMS` },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: `${loaderData.title} — Software Vala AMS` },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Page,
});

function Page() {
  const { type } = Route.useParams();
  const def = getCollectionType(type)!;
  return <SignatureCollection type={def} />;
}
