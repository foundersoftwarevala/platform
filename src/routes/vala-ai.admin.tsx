import { createFileRoute } from "@tanstack/react-router";
import { StudioAdmin } from "@/components/vala-ai/studio/StudioAdmin";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/vala-ai/admin")({
  head: pageHead("Admin · Vala AI", "Vala AI project and module management."),
  component: StudioAdmin,
});
