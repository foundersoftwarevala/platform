// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useGenerateSeoContentDraft,
  useGenerateSeoKeywordIdeas,
  useRunAutomation,
  useSearchConsoleSync,
  useSemrushSync,
  useSubmitIndexNow,
} from "../use-seo-actions";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: unknown) => handler }),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/seo.functions", () =>
  Object.fromEntries(
    [
      "deleteRecord",
      "generateSeoContentDraft",
      "generateSeoKeywordIdeas",
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
vi.mock("@/lib/bing-indexnow-integration.functions", () => ({
  submitToIndexNow: vi.fn().mockRejectedValue(new Error("Fixture executor not configured")),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

type FailureCase = { name: string; useAction: () => { run: () => Promise<unknown> } };

const cases: FailureCase[] = [
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
    name: "AI content generation",
    useAction: () => {
      const action = useGenerateSeoContentDraft();
      return {
        run: () => action.mutateAsync({ topic: "fixture topic", locale: "en" }),
      };
    },
  },
  {
    name: "AI keyword generation",
    useAction: () => {
      const action = useGenerateSeoKeywordIdeas();
      return {
        run: () => action.mutateAsync({ topic: "fixture topic", locale: "en", count: 10 }),
      };
    },
  },
  {
    name: "IndexNow submission",
    useAction: () => {
      const action = useSubmitIndexNow();
      return {
        run: () =>
          action.mutateAsync({
            host: "fixture.invalid",
            key: "fixture-indexnow-key",
            urls: ["https://fixture.invalid/"],
          }),
      };
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
