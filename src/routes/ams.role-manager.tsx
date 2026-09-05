import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ams/role-manager")({
  component: () => <Outlet />,
});
