// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoOverview } from "@/hooks/useDemoOverview";
import { useOpsDomain } from "@/hooks/useDemoOps";

const mocks = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const errors: Record<string, Error | undefined> = {};
  return { from: vi.fn(), eq: vi.fn(), in: vi.fn(), data, errors };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = { demos: [], demo_requests: [], marketplace_products: [], demo_domains: null };
  mocks.errors = {};
  mocks.from.mockImplementation((table: string) => {
    const terminal = async () => ({ data: mocks.data[table], error: mocks.errors[table] ?? null });
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: (...args: unknown[]) => {
        mocks.eq(table, ...args);
        return chain;
      },
      limit: vi.fn(terminal),
      maybeSingle: vi.fn(terminal),
      in: (...args: unknown[]) => {
        mocks.in(table, ...args);
        return terminal();
      },
    };
    return chain;
  });
});
afterEach(cleanup);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("demo read contracts", () => {
  it("maps requester/company columns and resolves the actual requested product", async () => {
    mocks.data.demo_requests = [
      {
        id: "request1",
        company: "Fixture Company",
        requester_name: "Fixture Requester",
        product_id: "product1",
        created_at: "2026-10-14T00:00:00Z",
        status: "pending",
      },
      {
        id: "request2",
        company: null,
        requester_name: "Independent Fixture",
        product_id: null,
        created_at: "2026-10-14T00:00:00Z",
        status: "pending",
      },
    ];
    mocks.data.marketplace_products = [{ id: "product1", name: "Fixture Product" }];
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toMatchObject([
      { company: "Fixture Company", requestedBy: "Fixture Requester", product: "Fixture Product" },
      {
        company: "Independent Fixture",
        requestedBy: "Independent Fixture",
        product: "Unspecified",
      },
    ]);
    expect(mocks.in).toHaveBeenCalledWith("marketplace_products", "id", ["product1"]);
  });

  it("does not query products when no requests reference one", async () => {
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.from).not.toHaveBeenCalledWith("marketplace_products");
  });

  it("surfaces a failed product lookup rather than silently substituting data", async () => {
    mocks.data.demo_requests = [{ id: "request1", product_id: "product1" }];
    const failure = new Error("Fixture product lookup refused");
    mocks.errors.marketplace_products = failure;
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.requestsError).toBe(failure));
  });

  it("queries the selected hostname, not an assumed demo/deployment relationship", async () => {
    mocks.data.demo_domains = { hostname: "demo.fixture.invalid", status: "live" };
    const { result } = renderHook(() => useOpsDomain("demo.fixture.invalid"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mocks.data.demo_domains);
    expect(mocks.eq).toHaveBeenCalledWith("demo_domains", "hostname", "demo.fixture.invalid");
  });

  it("surfaces domain read errors", async () => {
    const failure = new Error("Fixture domain read refused");
    mocks.errors.demo_domains = failure;
    const { result } = renderHook(() => useOpsDomain("demo.fixture.invalid"), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(failure));
  });
});
