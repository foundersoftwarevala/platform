import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { LockStatusPanel } from "@/components/vala-ai/panels/LockStatusPanel";

export const Route = createFileRoute("/vala-ai/lock")({
  head: pageHead("Lock State · Vala AI", "Execution locks currently held in the AI workspace."),
  component: LockStatusPanel,
});
