import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "./metrics";

type Handler = (context: { request: Request }) => Promise<Response>;
const get = (Route.options as unknown as { server: { handlers: { GET: Handler } } }).server.handlers.GET;

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public");
});

describe("influencer metrics currency breakdown", () => {
  it("returns amounts per currency and does not expose a mixed-currency revenue total", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/influencer_self_summary")) {
        return Response.json({
          profile: { id: "profile-1", full_name: "Creator", status: "active" },
          metrics: { revenue: 1050, sales: 2 },
        });
      }
      if (url.pathname.endsWith("/influencer_self_revenue_by_currency")) {
        return Response.json([
          { currency: "INR", amount: 1000 },
          { currency: "USD", amount: 50 },
        ]);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    }));

    const response = await get({
      request: new Request("https://softwarevala.net/api/influencer/metrics", {
        headers: { Authorization: "Bearer caller-token" },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.revenueByCurrency).toEqual([
      { currency: "INR", amount: 1000 },
      { currency: "USD", amount: 50 },
    ]);
    expect(body.metrics).toMatchObject({ revenue: null, sales: 2 });
  });
});
