import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Projects } from "@/components/vala-ai/screens/Projects";

export const Route = createFileRoute("/vala-ai/projects/")({
  head: pageHead("Projects · Vala AI", "Projects with permanent IDs and isolated workspaces."),
  component: Projects,
});
