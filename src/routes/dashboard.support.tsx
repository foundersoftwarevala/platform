import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { SupportWorkspace } from "@/components/sales-support/SupportWorkspace";

export const Route = createFileRoute("/dashboard/support")({
  component: () => (
    <RequireRole role={["support", "sales_support_manager", "finance_manager"]}>
      <SupportWorkspace />
    </RequireRole>
  ),
});
