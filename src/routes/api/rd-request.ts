import { createFileRoute } from "@tanstack/react-router";
import { handleSoftwareRequest } from "@/lib/rd-module/public-request.server";
import { rateLimited } from "@/lib/server/rate-limit";

export const Route = createFileRoute("/api/rd-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = await rateLimited(request, "rdRequest");
        if (limited) return limited;
        return handleSoftwareRequest(request);
      },
    },
  },
});
