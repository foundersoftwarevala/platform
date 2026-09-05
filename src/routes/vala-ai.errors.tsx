import { createFileRoute } from "@tanstack/react-router";
import { ErrorDetectionPanel } from "@/components/vala-ai/panels/ErrorDetectionPanel";

export const Route = createFileRoute("/vala-ai/errors")({
  component: ErrorDetectionPanel,
});
