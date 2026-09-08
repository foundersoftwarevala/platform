import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ExecutionLogsPanel } from "@/components/vala-ai/panels/ExecutionLogsPanel";

export const Route = createFileRoute("/vala-ai/logs")({
  head: pageHead("Execution Logs · Vala AI", "A record of every run the AI workspace has executed."),
  component: ExecutionLogsPanel,
});
