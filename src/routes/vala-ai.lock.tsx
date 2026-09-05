import { createFileRoute } from "@tanstack/react-router";
import { LockStatusPanel } from "@/components/vala-ai/panels/LockStatusPanel";

export const Route = createFileRoute("/vala-ai/lock")({
  component: LockStatusPanel,
});
