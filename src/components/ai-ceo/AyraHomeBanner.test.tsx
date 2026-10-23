// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { askAyra, getAyraLiveFeed } from "@/lib/ayra/functions";
import { AyraHomeBanner } from "./AyraHomeBanner";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (handler: unknown) => handler,
}));

vi.mock("@/lib/ayra/functions", () => ({
  askAyra: vi.fn(),
  getAyraLiveFeed: vi.fn(),
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows live metrics, read-only status, and links to the full AYRA page", async () => {
    vi.mocked(getAyraLiveFeed).mockResolvedValue(liveFeed);

    renderBanner();

    expect(await screen.findByText("ceo.ayra_home_live")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ceo.ayra_home_title" })).toBeTruthy();
    expect(screen.getByText("ceo.ayra_home_read_only")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("ceo.ayra_home_open").closest("a")?.getAttribute("href")).toBe(
      "/ai-ceo/ayra",
    );
  });

  it("submits a read-only question and renders AYRA's answer and inspected tools", async () => {
    vi.mocked(getAyraLiveFeed).mockResolvedValue(liveFeed);
    vi.mocked(askAyra).mockResolvedValue({
      answer: "Platform health is available.",
      toolsUsed: ["getPlatformHealth"],
    });

    renderBanner();

    const input = await screen.findByRole("textbox", { name: "ceo.ayra_question_label" });
    fireEvent.change(input, { target: { value: "Check platform health" } });
    fireEvent.click(screen.getByRole("button", { name: "ceo.ayra_send" }));

    expect(await screen.findByText("Platform health is available.")).toBeTruthy();
    expect(askAyra).toHaveBeenCalledWith({
      data: { prompt: "Check platform health" },
    });
    expect(screen.getByText("ceo.ayra_inspected")).toBeTruthy();
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
