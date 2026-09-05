import { createFileRoute } from "@tanstack/react-router";
import DemoOpsCenter from "@/components/demo-ops/DemoOpsCenter";

export const Route = createFileRoute("/demo-ops")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo Operations Center — Software Vala" },
      {
        name: "description",
        content:
          "Live demo operations: health monitoring, failure detection, branding validation, SSL and domain checks, expiry, security, analytics, alerts and audit trail.",
      },
    ],
  }),
  component: DemoOpsCenter,
});