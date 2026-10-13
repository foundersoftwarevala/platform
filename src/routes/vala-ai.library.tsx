import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Library } from "@/components/vala-ai/screens/Library";

export const Route = createFileRoute("/vala-ai/library")({
  head: pageHead("Software Library · Vala AI", "Metadata index of the master software library."),
  component: Library,
});
