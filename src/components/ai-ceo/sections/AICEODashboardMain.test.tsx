// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AICEODashboardMain from "./AICEODashboardMain";

const mocks = vi.hoisted(() => ({
  useCEOSuggestions: vi.fn(),
}));

vi.mock("@/hooks/useCEOSuggestions", () => mocks);
vi.mock("@/components/vala-ai/chat-stream", () => ({ streamChat: vi.fn() }));
vi.mock("@/components/JarvisCore", () => ({
  AYRA_LOOKS: { default: "/ayra.jpg" },
  LOOK_NAMES: { default: "AYRA" },
  LOOK_VIDEO: {},
  LOOK_SCENE: { default: "/ayra-scene.jpg" },
  LOOK_SCENE_VIDEO: {},
}));
vi.mock("@/components/ai-ceo/sections/CommandCenterIntelligence", () => ({
  CommandCenterIntelligence: () => null,
}));

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

    const { container } = render(<AICEODashboardMain />);
    const ayraBanner = screen.getByTestId("ayra-world-banner");
    const dashboardBanner = screen.getByRole("heading", { name: "AI CEO Dashboard" });

    expect(container.querySelectorAll('[data-testid="ayra-world-banner"]')).toHaveLength(1);
    expect(screen.getByText("AYRA'S WORLD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Screenshot" })).toBeTruthy();
    expect(
      ayraBanner.compareDocumentPosition(dashboardBanner) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
