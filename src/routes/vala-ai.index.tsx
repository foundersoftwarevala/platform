import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { StudioHome } from "@/components/vala-ai/studio/StudioHome";

export const Route = createFileRoute("/vala-ai/")({
  head: pageHead(
    "Build Studio · Vala AI",
    "Vala AI's integrated developer workspace, website builder and engineering tools.",
  ),
  component: StudioHome,
});
