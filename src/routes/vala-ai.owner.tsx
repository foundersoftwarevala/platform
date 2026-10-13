import { createFileRoute } from "@tanstack/react-router";
import { StudioOwner } from "@/components/vala-ai/studio/StudioOwner";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/vala-ai/owner")({
  head: pageHead("Owner · Vala AI", "Owner visibility for the existing Control Panel module."),
  component: StudioOwner,
});
