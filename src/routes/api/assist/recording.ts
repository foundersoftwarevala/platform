import { createFileRoute } from "@tanstack/react-router";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { AssistRecordingError, storeAssistRecording } from "@/lib/assist-manager/recording.server";

export const Route = createFileRoute("/api/assist/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearerToken(request.headers.get("authorization"));
        if (!token) {
          return Response.json({ error: "Sign in to upload an Assist recording." }, { status: 401 });
        }
        const user = await userFromBearerToken(token);
        if (!user) {
          return Response.json({ error: "The sign-in token is invalid or expired." }, { status: 401 });
        }
        if (!request.body) {
          return Response.json({ error: "A recording body is required." }, { status: 400 });
        }
        if (!/^video\/webm(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
          return Response.json({ error: "Only WebM video recordings are accepted." }, { status: 415 });
        }
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 128 * 1024 * 1024) {
          return Response.json({ error: "Recording exceeds the 128 MB limit." }, { status: 413 });
        }
        try {
          const result = await storeAssistRecording(
            request.body,
            request.headers.get("x-assist-session-id") ?? "",
            user.id,
          );
          return Response.json({ ok: true, ...result });
        } catch (error) {
          if (error instanceof AssistRecordingError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error("[assist-recording] upload failed", error);
          return Response.json({ error: "The recording could not be saved." }, { status: 500 });
        }
      },
    },
  },
});
