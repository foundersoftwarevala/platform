import { createFileRoute } from "@tanstack/react-router";
import { ExecutionLogsPanel } from "@/components/vala-ai/panels/ExecutionLogsPanel";

export const Route = createFileRoute("/vala-ai/logs")({
  component: ExecutionLogsPanel,
});
