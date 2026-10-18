// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunAutomation, useSearchConsoleSync, useSemrushSync } from "../use-seo-actions";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/seo.functions", () =>
  Object.fromEntries(
    [
      "deleteRecord",
      "generateSeoReport",
      "generateWithAi",
      "insertRecord",
      "runAutomation",
      "runSiteAudit",
      "runTechnicalChecks",
      "recrawlUrl",
      "syncSearchConsole",
      "syncSemrush",
      "updateRecord",
    ].map((name) => [
      name,
      vi.fn().mockRejectedValue(new Error("Fixture executor not configured")),
    ]),
  ),
);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const cases = [
  {
    name: "automation",
    useAction: () => {
      const action = useRunAutomation();
      return { run: () => action.mutateAsync("fixture-automation") };
    },
  },
  {
    name: "Search Console",
    useAction: () => {
      const action = useSearchConsoleSync();
      return { run: () => action.mutateAsync({ siteUrl: "https://fixture.invalid", days: 7 }) };
    },
  },
  {
    name: "Semrush",
    useAction: () => {
      const action = useSemrushSync();
      return { run: () => action.mutateAsync({ domain: "fixture.invalid", database: "in" }) };
    },
  },
];

describe("unavailable SEO actions", () => {
  it.each(cases)("reports $name failure without impossible success data", async ({ useAction }) => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useAction, { wrapper });
    await act(async () => {
      await expect(result.current.run()).rejects.toThrow("Fixture executor not configured");
    });
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Fixture executor not configured"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidation).not.toHaveBeenCalled();
  });
});
