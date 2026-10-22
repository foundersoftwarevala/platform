import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { SalesWorkspace } from "@/components/sales-support/SalesWorkspace";

export const Route = createFileRoute("/sales-crm")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  component: () => (
    <RequireRole role={["sales", "sales_support_manager", "finance_manager"]}>
      <SalesWorkspace />
    </RequireRole>
  ),
});
