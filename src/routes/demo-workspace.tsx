import { createFileRoute } from "@tanstack/react-router";
import ProductDemoManager from "@/pages/ProductDemoManager";

export const Route = createFileRoute("/demo-workspace")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo Workspace — Software Vala" },
      {
        name: "description",
        content:
          "Demo workspace for Software Vala: add or edit demos, click analytics, uptime alerts, rentals, bulk creation and login managers.",
      },
    ],
  }),
  component: ProductDemoManager,
});