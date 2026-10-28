// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AICEODashboardMain from "./AICEODashboardMain";

const mocks = vi.hoisted(() => ({
  useCEOSuggestions: vi.fn(),
}));

vi.mock("@/hooks/useCEOSuggestions", () => mocks);
vi.mock("@/components/vala-ai/chat-stream", () => ({ streamChat: vi.fn() }));
vi.mock("@/components/JarvisCore", () => ({
  AYRA_LOOKS: { default: "/ayra.jpg", amberSide: "/ayra-amber.jpg" },
  LOOK_NAMES: { default: "AYRA", amberSide: "Amber Side" },
  LOOK_THEME: { default: { primary: 235, accent: 210 }, amberSide: { primary: 55, accent: 72 } },
  LOOK_VIDEO: {},
  LOOK_SCENE: { default: "/ayra-scene.jpg", amberSide: "/ayra-amber-scene.jpg" },
  LOOK_SCENE_VIDEO: {},
}));
vi.mock("@/components/ai-ceo/sections/CommandCenterIntelligence", () => ({
  CommandCenterIntelligence: () => null,
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AICEODashboardMain />
    </QueryClientProvider>,
  );
}

describe("AICEODashboardMain", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the copied AYRA World interface above the AI CEO dashboard banner", () => {
    mocks.useCEOSuggestions.mockReturnValue({
      suggestions: [],
      ecosystemMetrics: null,
      metricSources: undefined,
      observations: [],
      activityEvents: [],
      degraded: [],
      isLoading: false,
      lastRefresh: null,
      isRefreshing: false,
      refresh: vi.fn(),
      sendToBoss: vi.fn(),
      getObservationsByCategory: vi.fn(() => []),
      getEventsByType: vi.fn(() => []),
    });

    const { container } = renderDashboard();
    const ayraBanner = screen.getByTestId("ayra-world-banner");
    const dashboardBanner = screen.getByRole("heading", { name: "AI CEO Dashboard" });

    expect(container.querySelectorAll('[data-testid="ayra-world-banner"]')).toHaveLength(1);
    expect(screen.getByText("AYRA'S WORLD")).toBeTruthy();
    const workspace = ayraBanner.querySelector(".aw-workspace");
    expect(workspace?.children).toHaveLength(1);
    expect(workspace?.querySelector(".aw-browser-panel")).toBeTruthy();
    expect(ayraBanner.querySelector(".aw-plan")?.parentElement?.classList.contains("aw-agents")).toBe(true);
    expect(ayraBanner.querySelector(".aw-bubble")).toBeNull();
    expect(ayraBanner.querySelector(".aw-browser-nav")).toBeNull();
    expect(screen.getByRole("button", { name: "Screenshot" })).toBeTruthy();
    expect(
      ayraBanner.compareDocumentPosition(dashboardBanner) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("changes the agent-side accent with the selected AYRA look", async () => {
    mocks.useCEOSuggestions.mockReturnValue({
      suggestions: [], ecosystemMetrics: null, metricSources: undefined, observations: [],
      activityEvents: [], degraded: [], isLoading: false, lastRefresh: null, isRefreshing: false,
      refresh: vi.fn(), sendToBoss: vi.fn(), getObservationsByCategory: vi.fn(() => []),
      getEventsByType: vi.fn(() => []),
    });

    const { container } = renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Amber Side" }));

    await waitFor(() => {
      const stage = container.querySelector(".aw-stage");
      expect(stage?.getAttribute("data-agent-look")).toBe("amberSide");
      expect(stage?.getAttribute("style")).toContain("55");
    });
  });
});
