import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Pipeline } from "@/components/vala-ai/screens/Pipeline";

export const Route = createFileRoute("/vala-ai/pipeline")({
  head: pageHead("Execution Pipeline · Vala AI", "Every task and the state it is in."),
  component: Pipeline,
});
