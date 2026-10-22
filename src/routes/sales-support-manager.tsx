import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sales-support-manager")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/sales" });
  },
});
