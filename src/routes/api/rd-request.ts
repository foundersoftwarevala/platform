import { createFileRoute } from "@tanstack/react-router";
import { handleSoftwareRequest } from "@/lib/rd-module/public-request.server";

export const Route = createFileRoute("/api/rd-request")({
  server: { handlers: { POST: ({ request }) => handleSoftwareRequest(request) } },
});
