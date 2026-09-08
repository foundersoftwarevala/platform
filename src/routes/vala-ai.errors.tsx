import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ErrorDetectionPanel } from "@/components/vala-ai/panels/ErrorDetectionPanel";

export const Route = createFileRoute("/vala-ai/errors")({
  head: pageHead("Errors · Vala AI", "Failed runs and error detail from the AI workspace."),
  component: ErrorDetectionPanel,
});
