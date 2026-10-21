import { createFileRoute } from "@tanstack/react-router";
import { FinanceDashboard } from "@/components/finance-manager/FinanceDashboard";

export const Route = createFileRoute("/control-panel/finance")({
  head: () => ({ meta: [{ title: "Developer Finance — Software Vala" }] }),
  component: FinanceDashboard,
});
