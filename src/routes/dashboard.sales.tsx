import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { SalesWorkspace } from "@/components/sales-support/SalesWorkspace";

export const Route = createFileRoute("/dashboard/sales")({
  component: () => (
    <RequireRole role={["sales", "sales_support_manager", "finance_manager"]}>
      <SalesWorkspace />
    </RequireRole>
  ),
});
