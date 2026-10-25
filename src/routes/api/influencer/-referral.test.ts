import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  generateUniqueCode: vi.fn(),
  rest: vi.fn(),
}));

vi.mock("@/lib/affiliate/core", () => ({
  ATTRIBUTION_WINDOW_DAYS: 60,
  currentUser: mocks.currentUser,
  generateUniqueCode: mocks.generateUniqueCode,
  rest: mocks.rest,
}));

import { Route } from "./referral";

type Handler = (context: { request: Request }) => Promise<Response>;
const get = (Route.options as unknown as { server: { handlers: { GET: Handler } } }).server.handlers
  .GET;
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public");
  mocks.currentUser.mockResolvedValue({ id: "user-1", email: "influencer@example.test" });
  mocks.rest.mockImplementation(async (path: string) => {
    if (path.startsWith("influencer_profiles")) {
      return json([{ id: "profile-1", user_id: "user-1", full_name: "Creator", status: "active" }]);
    }
    if (path.startsWith("marketplace_referral_codes")) {
      return json([
        { id: "code-1", code: "CODE1", active: true, created_at: "2026-10-01T00:00:00Z" },
      ]);
    }
    if (path === "rpc/marketplace_referral_link_analytics") {
      return json({
        links: [
          {
            id: "code-1",
            clicks: 2002,
            visitors: 1001,
            conversions: 1,
            commissions: [
              { status: "pending", currency: "INR", amount: 2501, lines: 2501 },
              { status: "pending", currency: "USD", amount: 2500, lines: 2500 },
            ],
          },
        ],
        commissions: [
          { status: "pending", currency: "INR", amount: 2501, lines: 2501 },
          { status: "pending", currency: "USD", amount: 2500, lines: 2500 },
        ],
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ tier: "starter" })),
  );
});

describe("influencer referral analytics aggregation", () => {
  it("uses one database aggregation for sessions and currency-separated commissions", async () => {
    const response = await get({
      request: new Request("https://softwarevala.net/api/influencer/referral", {
        headers: { Authorization: "Bearer caller-token" },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.links[0]).toMatchObject({
      clicks: 2002,
      visitors: 1001,
      conversions: 1,
    });
    expect(body.commissions.pending).toEqual([
      { currency: "INR", amount: 2501 },
      { currency: "USD", amount: 2500 },
    ]);
    expect(body.commissions.lines).toBe(5001);
    const analyticsCalls = mocks.rest.mock.calls.filter(
      ([path]) => String(path) === "rpc/marketplace_referral_link_analytics",
    );
    expect(analyticsCalls).toHaveLength(1);
    expect(analyticsCalls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        p_code_ids: ["code-1"],
        p_partner_kind: "influencer",
        p_partner_id: "profile-1",
      }),
    });
  });
});
