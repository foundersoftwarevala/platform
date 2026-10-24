import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  summary: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: state.getUser, getSession: state.getSession },
    from: state.from,
  },
}));
vi.mock("@/lib/influencer/programme.functions", () => ({
  getInfluencerProgramme: state.summary,
}));

import { influencerDashboardQueryOptions, influencerProgrammeQueryOptions } from "./analytics";

class QueryBuilder {
  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: { id: "profile-id", user_id: "user-id", status: "active" },
      error: null,
    });
  }

  limit() {
    return Promise.resolve({
      data: this.table === "influencer_profiles" ? [{ id: "profile-id", status: "active" }] : [],
      error: null,
    });
  }

  in() {
    return Promise.resolve({ data: [], error: null });
  }
}

function summary(sales: number, leads: number) {
  return {
    influencers: 3,
    influencers_active: 2,
    applications_total: 4,
    applications_pending: 1,
    assignments: 5,
    assignments_active: 2,
    social_accounts: 6,
    followers_total: 1000,
    followers_verified: 500,
    earnings_net: 250,
    payouts_total: 100,
    payouts_paid: 75,
    payouts_pending: 1,
    invoices: 2,
    compensation_rules: 1,
    sales,
    leads,
    unattributable: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  state.getSession.mockResolvedValue({
    data: { session: { access_token: "caller-access-token" } },
    error: null,
  });
  state.from.mockImplementation((table: string) => new QueryBuilder(table));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("influencer programme attributed metrics", () => {
  it("uses persisted sales and lead counts from the summary RPC", async () => {
    state.summary.mockResolvedValue(summary(7, 12));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await queryClient.fetchQuery(influencerProgrammeQueryOptions());

    expect(result.metrics.sales.value).toBe(7);
    expect(result.metrics.leads.value).toBe(12);
  });

  it("preserves verified zero counts as real zeroes", async () => {
    state.summary.mockResolvedValue(summary(0, 0));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await queryClient.fetchQuery(influencerProgrammeQueryOptions());

    expect(result.metrics.sales.value).toBe(0);
    expect(result.metrics.leads.value).toBe(0);
  });

  it("does not present an unavailable metric as zero", async () => {
    state.summary.mockResolvedValue(summary(Number.NaN, 12));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(queryClient.fetchQuery(influencerProgrammeQueryOptions())).rejects.toThrow(
      /sales count is unavailable/,
    );
  });

  it("loads creator sales and leads through the caller-scoped summary API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ metrics: { sales: 2, leads: 5 } }), { status: 200 }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await queryClient.fetchQuery(influencerDashboardQueryOptions());

    expect(result.metrics.sales.value).toBe(2);
    expect(result.metrics.leads.value).toBe(5);
    expect(fetch).toHaveBeenCalledWith(
      "/api/influencer/metrics",
      expect.objectContaining({
        headers: { Authorization: "Bearer caller-access-token" },
      }),
    );
  });

  it("surfaces unavailable creator attribution metrics instead of returning zeroes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ metrics: { sales: null, leads: 5 } }), { status: 200 }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(queryClient.fetchQuery(influencerDashboardQueryOptions())).rejects.toThrow(
      /sales count is unavailable/,
    );
  });
});
