import { createFileRoute } from "@tanstack/react-router";
import {
  createDemoVisitorSession,
  DemoUnavailableError,
  findDemoVisitorSession,
} from "@/lib/demo/sessions.server";
import { rateLimited } from "@/lib/server/rate-limit";
import { issueDemoTicket } from "@/lib/demo/ticket";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/demo/ticket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = await rateLimited(request, "demoProxy");
        if (limited) return limited;

        try {
          const body = (await request.json()) as {
            slug?: unknown;
            visitor_session_id?: unknown;
          };
          const slug = typeof body.slug === "string" ? body.slug.trim() : "";
          if (!slug || slug.length > 120) {
            return Response.json({ error: "Which demo?" }, { status: 400 });
          }

          let session;
          if (typeof body.visitor_session_id === "string") {
            if (!UUID.test(body.visitor_session_id)) {
              return Response.json({ error: "Invalid demo session." }, { status: 400 });
            }
            session = await findDemoVisitorSession(body.visitor_session_id, slug);
          } else {
            session = await createDemoVisitorSession(slug);
          }
          if (!session) {
            return Response.json(
              { error: "This demo session is unavailable or has expired." },
              { status: 404 },
            );
          }

          const ticket = issueDemoTicket(
            slug,
            session.sessionId,
            session.demoId,
            session.categoryId,
          );
          if (!ticket) {
            return Response.json({ error: "Demos are not available right now." }, { status: 503 });
          }

          return Response.json(
            {
              ticket,
              demoId: session.demoId,
              demoName: session.demoName || session.productName,
              sessionId: session.sessionId,
              expiresAt: session.expiresAt,
            },
            { headers: { "Cache-Control": "private, no-store" } },
          );
        } catch (error) {
          if (error instanceof DemoUnavailableError) {
            return Response.json(
              { error: "This product has no category-matched live demo." },
              { status: 404 },
            );
          }
          console.error("[demo ticket] request failed", error);
          return Response.json(
            { error: "Could not check this demo right now. Please try again." },
            { status: 503 },
          );
        }
      },
    },
  },
});
