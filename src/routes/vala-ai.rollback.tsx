import { createFileRoute } from "@tanstack/react-router";
import { RollbackPanel } from "@/components/vala-ai/panels/RollbackPanel";

export const Route = createFileRoute("/vala-ai/rollback")({
  component: RollbackPanel,
});
