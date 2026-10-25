import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (context: { request: Request }) => Promise<Response>;
const state = vi.hoisted(() => ({
  handlers: null as { GET: Handler; POST: Handler } | null,
  guard: vi.fn(),
  provider: vi.fn(),
  send: vi.fn(),
  requeue: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { GET: Handler; POST: Handler } } }) => {
    state.handlers = options.server.handlers;
    return options;
  },
}));
vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: state.guard,
}));
vi.mock("@/lib/commerce/mailer", () => ({
  MAX_ATTEMPTS: 5,
  providerConfigured: state.provider,
  sendQueued: state.send,
  requeueFailed: state.requeue,
}));

import "./email-flush";

function get() {
  if (!state.handlers) throw new Error("Email flush handlers were not registered");
  return state.handlers.GET({ request: new Request("https://fixture.invalid/api/internal/email-flush") });
}

function post() {
  if (!state.handlers) throw new Error("Email flush handlers were not registered");
  return state.handlers.POST({
    request: new Request("https://fixture.invalid/api/internal/email-flush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://database.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  vi.clearAllMocks();
  state.guard.mockResolvedValue({ ok: true });
  state.provider.mockReturnValue("resend");
  state.send.mockResolvedValue({ attempted: 0, sent: 0, retrying: 0, failed: 0 });
  state.requeue.mockResolvedValue({ requeued: 0 });
});

describe("email queue health", () => {
  it("returns 500 instead of a zero count when the database request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("database unavailable", { status: 503 })));

    const response = await get();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not read email queue status" });
  });

  it("returns 500 when the server cannot confirm post-flush pending count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, {
        status: 200,
        headers: { "content-range": "*/*" },
      })),
    );

    const response = await post();
    expect(state.send).toHaveBeenCalledWith(50);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not flush email queue" });
  });

  it("preserves an exact empty queue count as zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, {
        status: 200,
        headers: { "content-range": "*/0" },
      })),
    );

    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pending: 0, sent: 0, failed: 0 });
  });
});
