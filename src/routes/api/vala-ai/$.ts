import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "@/lib/vala-ai/api.server";
import { resolveCaller } from "@/lib/vala-ai/platform-auth.server";

/** Vala AI's API. The caller is the Control Panel session; roles and validation live in `handleApi`. */
export const Route = createFileRoute("/api/vala-ai/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleApi(request, resolveCaller),
      POST: ({ request }) => handleApi(request, resolveCaller),
      PATCH: ({ request }) => handleApi(request, resolveCaller),
    },
  },
});
