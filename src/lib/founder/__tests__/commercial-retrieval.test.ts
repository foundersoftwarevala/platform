import { afterEach, describe, expect, it, vi } from "vitest";

import { loadCommercialSummary } from "../intelligence/commercial-retrieval.server";

const summary = {
  measured_at: "2026-10-25T03:00:00.000Z",
  sales_deals: [{ stage: "proposal", count: 2, recorded_value: "1500.00" }],
  sales_leads: [],
  lead_manager_leads: [{ status: "won", count: 1, recorded_value: "2000.00" }],
  unavailable_sources: [],
  marketplace_orders: [{ status: "paid", currency: "INR", count: 3, total: "900.00" }],
  tasks: [{ status: "blocked", count: 4, overdue: 2 }],
};

describe("AYRA commercial retrieval", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests the RPC with the caller token and validates its response", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(loadCommercialSummary("caller-token")).resolves.toEqual(summary);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://db.example.test/rest/v1/rpc/ayra_commercial_summary");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("apikey")).toBe("publishable-key");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer caller-token");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails explicitly when the aggregate RPC is unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));

    await expect(loadCommercialSummary("caller-token")).rejects.toThrow(
      "AYRA commercial retrieval failed (404)",
    );
  });

  it("rejects malformed aggregates instead of presenting them as facts", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ...summary, tasks: [{ status: "blocked", count: -1, overdue: 0 }] }),
          {
            status: 200,
          },
        ),
      ),
    );

    await expect(loadCommercialSummary("caller-token")).rejects.toThrow();
  });

  it("refuses to send a request without an authenticated user token", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(loadCommercialSummary("")).rejects.toThrow(
      "An authenticated user token is required",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
