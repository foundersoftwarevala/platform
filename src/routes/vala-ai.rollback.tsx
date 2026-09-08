import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { RollbackPanel } from "@/components/vala-ai/panels/RollbackPanel";

export const Route = createFileRoute("/vala-ai/rollback")({
  head: pageHead("Rollback · Vala AI", "Roll a project in the AI workspace back to an earlier state."),
  component: RollbackPanel,
});
