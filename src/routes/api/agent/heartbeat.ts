import { createFileRoute } from "@tanstack/react-router";
import { handleAgentHeartbeat } from "@/lib/server-manager/heartbeat.server";

export const Route = createFileRoute("/api/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => handleAgentHeartbeat(request),
    },
  },
});
