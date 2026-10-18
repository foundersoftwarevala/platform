import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { clientAddress } from "@/lib/i18n/limits";
import {
  LANGUAGE_SESSION_COOKIE,
  languageAuthorization,
  sameOriginMutation,
} from "@/lib/i18n/session-contract";
import { messageText } from "@/lib/i18n/messages";

const credentials = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();
const cookie = (token: string, maxAge = 3600) =>
  `${LANGUAGE_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const headers = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/i18n/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveCaller } = await import("@/lib/i18n/service.server");
        const caller = await resolveCaller(languageAuthorization(request), "session");
        return Response.json(
          { authenticated: caller.tier !== "anonymous", tier: caller.tier },
          { headers },
        );
      },
      POST: async ({ request }) => {
        if (!sameOriginMutation(request))
          return Response.json({ reason: "origin_refused" }, { status: 403, headers });
        if (Number(request.headers.get("content-length") ?? 0) > 4096)
          return Response.json({ reason: "invalid_request" }, { status: 413, headers });
        try {
          const raw = await request.text();
          if (raw.length > 4096)
            return Response.json({ reason: "invalid_request" }, { status: 413, headers });
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            return Response.json({ reason: "invalid_request" }, { status: 400, headers });
          }
          const parsed = credentials.safeParse(body);
          if (!parsed.success)
            return Response.json({ reason: "invalid_request" }, { status: 400, headers });
          const { db } = await import("@/lib/i18n/database.server");
          const { reserveEngineQuota } = await import("@/lib/i18n/quota.server");
          const { sourceHash } = await import("@/lib/i18n/hash");
          const address = clientAddress(request.headers, getRequestIP() ?? null);
          const subject = await sourceHash(address);
          const allowed = await reserveEngineQuota(await db(), 1, [
            { subject: `i18n-login:${subject}`, limit: 10, seconds: 900 },
            {
              subject: `i18n-login-email:${await sourceHash(parsed.data.email.toLowerCase())}`,
              limit: 10,
              seconds: 900,
            },
          ]);
          if (!allowed.allowed)
            return Response.json(
              { reason: "rate_limited" },
              { status: 429, headers: { ...headers, "Retry-After": "900" } },
            );
          const { createLanguageSession } = await import("@/lib/i18n/session.server");
          const token = await createLanguageSession(parsed.data.email, parsed.data.password);
          if (!token)
            return Response.json(
              {
                reason: "authentication_required",
                error: messageText("common.language_sign_in_refused"),
              },
              { status: 401, headers },
            );
          return Response.json(
            { authenticated: true },
            { headers: { ...headers, "Set-Cookie": cookie(token) } },
          );
        } catch (error) {
          console.error(
            "[i18n] native sign-in failed",
            error instanceof Error ? error.name : "error",
          );
          return Response.json({ reason: "service_error" }, { status: 503, headers });
        }
      },
      DELETE: async ({ request }) => {
        if (!sameOriginMutation(request))
          return Response.json({ reason: "origin_refused" }, { status: 403, headers });
        const token = languageAuthorization(request)?.slice(7) ?? "";
        const { revokeLanguageSession } = await import("@/lib/i18n/session.server");
        await revokeLanguageSession(token);
        return Response.json(
          { authenticated: false },
          { headers: { ...headers, "Set-Cookie": cookie("", 0) } },
        );
      },
    },
  },
});
