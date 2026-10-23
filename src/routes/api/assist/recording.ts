import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { AssistRecordingError, storeAssistRecording } from "@/lib/assist-manager/recording.server";

export const Route = createFileRoute("/api/assist/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        const token = bearerToken(request.headers.get("authorization"));
        if (!token) {
          return Response.json({ error: await translateText("chat.api_sign_in_to_upload_an_assist_recording_8fde373") }, { status: 401 });
        }
        const user = await userFromBearerToken(token);
        if (!user) {
          return Response.json({ error: await translateText("chat.api_the_sign_in_token_is_invalid_or_expired_d7e65b9") }, { status: 401 });
        }
        if (!request.body) {
          return Response.json({ error: await translateText("chat.api_a_recording_body_is_required_34115d9") }, { status: 400 });
        }
        if (!/^video\/webm(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
          return Response.json({ error: await translateText("chat.api_only_webm_video_recordings_are_accepted_31ad15a") }, { status: 415 });
        }
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 128 * 1024 * 1024) {
          return Response.json({ error: await translateText("chat.api_recording_exceeds_the_128_mb_limit_edd80cd") }, { status: 413 });
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
          return Response.json({ error: await translateText("chat.api_the_recording_could_not_be_saved_33dd0d2") }, { status: 500 });
        }
      },
    },
  },
});
