import { createFileRoute } from "@tanstack/react-router";

import DemoManagerDashboard from "@/pages/DemoManagerDashboard";

export const Route = createFileRoute("/demo-manager")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo Manager Dashboard — Software Vala" },
      {
        name: "description",
        content:
          "Operational dashboard for Software Vala demos: status grid, broken demos, uptime monitor, URL manager and activity log.",
      },
      { property: "og:title", content: "Demo Manager Dashboard — Software Vala" },
      {
        property: "og:description",
        content:
          "Status grid, uptime monitoring, URL management and activity logs for every Software Vala demo.",
      },
    ],
  }),
  component: DemoManagerDashboard,
});
