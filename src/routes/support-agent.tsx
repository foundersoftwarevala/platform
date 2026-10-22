import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { SupportWorkspace } from "@/components/sales-support/SupportWorkspace";

export const Route = createFileRoute("/support-agent")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  component: () => (
    <RequireRole role={["support", "sales_support_manager", "finance_manager"]}>
      <SupportWorkspace initialTab="tickets" />
    </RequireRole>
  ),
});
