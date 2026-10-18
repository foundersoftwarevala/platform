// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLegalLogs, useMisuseAlerts } from "../legal-data";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function queryResult(data: unknown[], error: Error | null = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, order };
}

describe("legal view mappings", () => {
  it("maps real audit columns to the existing view contract", async () => {
    const { wrapper, order } = queryResult([
      {
        id: "log1",
        ref_code: "LOG-1",
        created_at: "2026-10-14T00:00:00Z",
        entity_type: "trademark",
        reason: "Verified evidence",
        action: "Reviewed",
        actor: "operator",
      },
    ]);
    const { result } = renderHook(() => useLegalLogs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: "log1",
      category: "trademark",
      details: "Verified evidence",
      logged_at: "2026-10-14T00:00:00Z",
      immutable: true,
    });
    expect(mocks.from).toHaveBeenCalledWith("legal_logs");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("handles nullable audit metadata without inventing details", async () => {
    const { wrapper } = queryResult([
      { created_at: "2026-10-14", entity_type: null, reason: null },
    ]);
    const { result } = renderHook(() => useLegalLogs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ category: "other", details: "" });
  });

  it("preserves misuse alert fields and represents the absent AI score explicitly", async () => {
    const { wrapper } = queryResult([
      {
        ref_code: "ALERT-1",
        asset_ref: "ASSET-1",
        asset_name: "Brand",
        severity: "high",
        description: null,
        detected_in: "Reported site",
        created_at: "2026-10-14",
      },
    ]);
    const { result } = renderHook(() => useMisuseAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      ref_code: "ALERT-1",
      asset_ref: "ASSET-1",
      severity: "high",
      detected_at: "2026-10-14",
      ai_confidence: null,
      description: null,
    });
  });

  it.each(["logs", "misuse"])("surfaces %s query failures", async (kind) => {
    const failure = new Error("fixture read refused");
    const { wrapper } = queryResult([], failure);
    const { result } = renderHook(() => (kind === "logs" ? useLegalLogs() : useMisuseAlerts()), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
  });
});
