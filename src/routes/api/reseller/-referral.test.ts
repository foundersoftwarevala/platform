import { beforeEach, describe, expect, it, vi } from "vitest";

const affiliate = vi.hoisted(() => ({
  currentUser: vi.fn(),
  generateUniqueCode: vi.fn(),
  rest: vi.fn(),
}));

vi.mock("@/lib/affiliate/core", () => ({
  ATTRIBUTION_WINDOW_DAYS: 30,
  currentUser: affiliate.currentUser,
  generateUniqueCode: affiliate.generateUniqueCode,
  rest: affiliate.rest,
}));

import { Route } from "./referral";

type Handler = (context: { request: Request }) => Promise<Response>;

const handlers = (
  Route.options as unknown as {
    server: { handlers: { GET: Handler; POST: Handler } };
  }
).server.handlers;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  affiliate.currentUser.mockResolvedValue({ id: "user-1" });
});

describe("reseller referral dependency failures", () => {
  it("does not report a database outage as a non-reseller account", async () => {
    affiliate.rest.mockResolvedValueOnce(json({ error: "down" }, 503));

    const response = await handlers.GET({
      request: new Request("https://softwarevala.net/api/reseller/referral"),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Your reseller account could not be checked",
    });
  });

  it("does not turn failed referral-session reads into zero activity", async () => {
    affiliate.rest
      .mockResolvedValueOnce(json([{ id: "reseller-1", name: "Test", status: "active" }]))
      .mockResolvedValueOnce(
        json([{ id: "code-1", code: "SVR123", active: true, created_at: "2026-10-08T00:00:00Z" }]),
      )
      .mockResolvedValueOnce(json({ error: "down" }, 503));

    const response = await handlers.GET({
      request: new Request("https://softwarevala.net/api/reseller/referral"),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Referral activity could not be read",
    });
  });

  it("does not create another link when the active-link count failed", async () => {
    affiliate.rest
      .mockResolvedValueOnce(json([{ id: "reseller-1", name: "Test", status: "active" }]))
      .mockResolvedValueOnce(json({ error: "down" }, 503));

    const response = await handlers.POST({
      request: new Request("https://softwarevala.net/api/reseller/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-link" }),
      }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Your existing links could not be checked",
    });
    expect(affiliate.generateUniqueCode).not.toHaveBeenCalled();
  });
});
