import { createFileRoute, Outlet } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/ams/role-manager")({
  head: pageHead("Role Manager · AMS", "Roles, stages and progression in the Achievement Management System."),
  component: () => <Outlet />,
});
