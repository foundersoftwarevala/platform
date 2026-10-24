// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAyraLiveFeed } from "@/lib/ayra/functions";
import { AyraHomeBanner } from "./AyraHomeBanner";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (handler: unknown) => handler,
}));

vi.mock("@/lib/ayra/functions", () => ({
  askAyra: vi.fn(),
  getAyraLiveFeed: vi.fn(),
  getAyraCommandSettings: vi.fn(),
  saveAyraCommandSettings: vi.fn(),
}));

vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    formatDate: (value: string | Date) => String(value),
  }),
}));

const liveFeed = {
  asOf: "2026-10-23T12:00:00.000Z",
  activeTasks: 12,
  brokenPromises: 2,
  pendingPayments: 5,
  duePayments: 3,
  chatSessions: 8,
  chatMessages: 24,
  amsEvents: 4,
  amsAwards: 1,
  alerts: [],
};

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AyraHomeBanner />
    </QueryClientProvider>,
  );
}

describe("AyraHomeBanner", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the AYRA portrait banner and live read-only metrics without duplicating chat", async () => {
    vi.mocked(getAyraLiveFeed).mockResolvedValue(liveFeed);

    renderBanner();

    expect(await screen.findByText("ceo.ayra_home_live")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ceo.ayra_home_title" })).toBeTruthy();
    expect(screen.getByText("ceo.ayra_home_read_only")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByRole("img", { name: /ceo\.ayra_title — Cyan Jacket/ })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows feed failures and unknown metrics instead of implying the system is empty", async () => {
    vi.mocked(getAyraLiveFeed).mockRejectedValue(new Error("Feed unavailable"));

    renderBanner();

    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("ceo.ayra_feed_failed");
    expect(error.textContent).toContain("Feed unavailable");
    expect(screen.getByText("ceo.ayra_home_unavailable")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
