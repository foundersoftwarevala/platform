import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rest: vi.fn(),
  requireAffiliate: vi.fn(),
}));

vi.mock("@/lib/affiliate/core", () => ({
  ATTRIBUTION_WINDOW_DAYS: 60,
  currentUser: vi.fn(),
  generateUniqueCode: vi.fn(),
  partnerForUser: vi.fn(),
  requireAffiliate: mocks.requireAffiliate,
  rest: mocks.rest,
}));
vi.mock("@/lib/applications/gateway.server", () => ({ bearer: vi.fn() }));
vi.mock("@/lib/applications/submit.server", () => ({ submitApplication: vi.fn() }));

import { Route } from "./account";

type Handler = (context: { request: Request }) => Promise<Response>;
const get = (Route.options as unknown as { server: { handlers: { GET: Handler } } }).server.handlers
  .GET;
const json = (body: unknown, status = 200) => Response.json(body, { status });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAffiliate.mockResolvedValue({
    ok: true,
    partner: {
      id: "affiliate-1",
      display_name: "Affiliate",
      status: "approved",
      created_at: "2026-10-01T00:00:00Z",
    },
  });
  mocks.rest.mockImplementation(async (path: string) => {
    if (path.startsWith("marketplace_referral_codes")) {
      return json([
        {
          id: "code-1",
          code: "CODE1",
          active: true,
          created_at: "2026-10-01T00:00:00Z",
        },
      ]);
    }
    if (path === "rpc/marketplace_referral_link_analytics") {
      return json({
        links: [
          {
            id: "code-1",
            clicks: 12,
            visitors: 8,
            conversions: 2,
            commissions: [{ status: "paid", currency: "INR", amount: 500, lines: 2 }],
          },
        ],
        commissions: [{ status: "paid", currency: "INR", amount: 500, lines: 2 }],
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});

describe("affiliate referral analytics aggregation", () => {
  it("loads session and commission totals with one grouped RPC call", async () => {
    const response = await get({
      request: new Request("https://softwarevala.net/api/affiliate/account"),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.links[0]).toMatchObject({
      id: "code-1",
      clicks: 12,
      visitors: 8,
      conversions: 2,
      commissionsByCurrency: [{ currency: "INR", amount: 500 }],
    });
    expect(
      mocks.rest.mock.calls.filter(([path]) => path === "rpc/marketplace_referral_link_analytics"),
    ).toHaveLength(1);
  });
});
