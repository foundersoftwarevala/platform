// The leading dash keeps TanStack Router from registering this test as a route.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Post = (context: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };

const mocks = vi.hoisted(() => ({
  aiStream: vi.fn(),
  requireAuthorizedAiCaller: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestIP: () => undefined,
}));
vi.mock("@/lib/ai-gateway.server", () => ({ aiStream: mocks.aiStream }));
vi.mock("@/lib/ai-request-auth.server", () => ({
  requireAuthorizedAiCaller: mocks.requireAuthorizedAiCaller,
}));

import { Route } from "./chat";

const post = (Route.options as typeof Route.options & RouteOptions).server.handlers.POST;

describe("AYRA /api/chat prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthorizedAiCaller.mockResolvedValue({ id: "operator-1" });
  });

  it("adds truthful capability context and passes through the existing streamed response", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[]}\n\n'));
        controller.close();
      },
    });
    const upstreamResponse = new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
    mocks.aiStream.mockResolvedValue(upstreamResponse);

    const response = await post({
      request: new Request("https://fixture.invalid/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "AYRA status?" }] }),
      }),
    });

    expect(response).toBe(upstreamResponse);
    const [options] = mocks.aiStream.mock.calls[0] as unknown as [
      { module: string; messages: { role: string; content: string }[] },
    ];
    expect(options.module).toBe("assistant");
    expect(options.messages[0]?.role).toBe("system");
    expect(options.messages[0]?.content).toContain("authenticated, server-side /api/chat route");
    expect(options.messages[0]?.content).toContain("141 agent definitions");
    expect(options.messages[0]?.content).toContain("Do not claim that all 171 workers execute");
    expect(options.messages.at(-1)).toEqual({ role: "user", content: "AYRA status?" });
  });
});
