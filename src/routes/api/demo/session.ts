import { createFileRoute } from "@tanstack/react-router";
import { rateLimited } from "@/lib/server/rate-limit";
import {
  createDemoVisitorSession,
  DemoUnavailableError,
  endDemoVisitorSession,
} from "@/lib/demo/sessions.server";
import { readDemoTicket } from "@/lib/demo/ticket";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/demo/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = await rateLimited(request, "demoProxy");
        if (limited) return limited;
        try {
          const body = (await request.json()) as {
            slug?: unknown;
            action?: unknown;
            sessionId?: unknown;
            ticket?: unknown;
          };
          if (body.action === "end") {
            const ticket = readDemoTicket(typeof body.ticket === "string" ? body.ticket : null);
            const sessionId =
              typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
            if (!ticket || !sessionId || ticket.sessionId !== sessionId) {
              return Response.json({ error: "Invalid demo session." }, { status: 400 });
            }
            await endDemoVisitorSession(sessionId);
            return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
          }

          const slug = typeof body.slug === "string" ? body.slug.trim() : "";
          if (!slug || slug.length > 120) {
            return Response.json({ error: "Choose a product demo." }, { status: 400 });
          }
          const session = await createDemoVisitorSession(slug);
          return Response.json(
            { sessionId: session.sessionId },
            { headers: { "Cache-Control": "private, no-store" } },
          );
        } catch (error) {
          if (error instanceof DemoUnavailableError) {
            return Response.json(
              { error: "This product has no category-matched live demo." },
              { status: 404 },
            );
          }
          console.error("[demo session] request failed", error);
          return Response.json({ error: "Could not start this demo right now." }, { status: 503 });
        }
      },
    },
  },
});
