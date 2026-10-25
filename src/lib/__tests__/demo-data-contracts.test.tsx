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
const serverFunctions = vi.hoisted(() => ({
  listManagedDemos: vi.fn(),
  listPendingDemoRequests: vi.fn(),
  setManagedDemoStatus: vi.fn(),
  extendManagedDemo: vi.fn(),
  cloneManagedDemo: vi.fn(),
  respondToDemoRequest: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/demo-manager/demos.functions", () => serverFunctions);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = { demo_domains: null };
  mocks.errors = {};
  serverFunctions.listManagedDemos.mockResolvedValue([]);
  serverFunctions.listPendingDemoRequests.mockResolvedValue([]);
  serverFunctions.setManagedDemoStatus.mockResolvedValue(undefined);
  serverFunctions.extendManagedDemo.mockResolvedValue(undefined);
  serverFunctions.cloneManagedDemo.mockResolvedValue(undefined);
  serverFunctions.respondToDemoRequest.mockResolvedValue(undefined);
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
  it("maps server-returned requester/company columns and product names", async () => {
    serverFunctions.listPendingDemoRequests.mockResolvedValue([
      {
        request: {
          id: "00000000-0000-4000-8000-000000000001",
          company: "Fixture Company",
          requester_name: "Fixture Requester",
          product_id: "00000000-0000-4000-8000-000000000010",
          created_at: "2026-10-14T00:00:00Z",
          status: "pending",
        },
        productName: "Fixture Product",
      },
      {
        request: {
          id: "00000000-0000-4000-8000-000000000002",
          company: null,
          requester_name: "Independent Fixture",
          product_id: null,
          created_at: "2026-10-14T00:00:00Z",
          status: "pending",
        },
        productName: null,
      },
    ]);
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
    expect(serverFunctions.listPendingDemoRequests).toHaveBeenCalledOnce();
    expect(serverFunctions.listManagedDemos).toHaveBeenCalledWith({ data: { limit: 200 } });
  });

  it("uses only server functions for Demo Manager reads", async () => {
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(serverFunctions.listPendingDemoRequests).toHaveBeenCalledOnce();
    expect(serverFunctions.listManagedDemos).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces a failed server request lookup rather than silently substituting data", async () => {
    const failure = new Error("Fixture request lookup refused");
    serverFunctions.listPendingDemoRequests.mockRejectedValue(failure);
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.requestsError).toBe(failure));
  });

  it("routes overview mutations through caller-scoped server functions", async () => {
    const { result } = renderHook(useDemoOverview, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.setDemoStatus.mutateAsync({
      id: "00000000-0000-4000-8000-000000000001",
      status: "maintenance",
    });
    await result.current.extendDemo.mutateAsync({
      id: "00000000-0000-4000-8000-000000000001",
      days: 7,
    });
    await result.current.cloneDemo.mutateAsync("00000000-0000-4000-8000-000000000001");
    await result.current.respondToRequest.mutateAsync({
      id: "00000000-0000-4000-8000-000000000002",
      status: "approved",
    });

    expect(serverFunctions.setManagedDemoStatus).toHaveBeenCalledWith({
      data: { id: "00000000-0000-4000-8000-000000000001", status: "maintenance" },
    });
    expect(serverFunctions.extendManagedDemo).toHaveBeenCalledWith({
      data: { id: "00000000-0000-4000-8000-000000000001", days: 7 },
    });
    expect(serverFunctions.cloneManagedDemo).toHaveBeenCalledWith({
      data: { id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(serverFunctions.respondToDemoRequest).toHaveBeenCalledWith({
      data: { id: "00000000-0000-4000-8000-000000000002", status: "approved" },
    });
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
