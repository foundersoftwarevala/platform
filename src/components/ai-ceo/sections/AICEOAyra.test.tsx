// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AICEOAyra from "./AICEOAyra";

const mocks = vi.hoisted(() => ({
  useAyraCapabilities: vi.fn(),
  useAyraOrders: vi.fn(),
}));

vi.mock("@/hooks/useAyra", () => mocks);
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/vala-ai/chat-stream", () => ({
  streamChat: vi.fn(),
}));
vi.mock("@/components/JarvisCore", () => ({
  JarvisCore: () => <div aria-label="AYRA avatar" />,
  AYRA_LOOKS: { default: "/ayra.jpg" },
  LOOK_NAMES: { default: "AYRA" },
  LOOK_VIDEO: {},
  LOOK_SCENE: { default: "/ayra-scene.jpg" },
  LOOK_SCENE_VIDEO: {},
}));

describe("AICEOAyra page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps the purple AYRA banner and capability lists on the AYRA sub-page", () => {
    mocks.useAyraCapabilities.mockReturnValue({
      capabilities: [],
      connected: 0,
      notConnected: 0,
      isLoading: false,
      failed: false,
      denied: false,
      refetch: vi.fn(),
    });
    mocks.useAyraOrders.mockReturnValue({
      orders: [],
      degraded: [],
      isLoading: false,
      failed: false,
      denied: false,
      refetch: vi.fn(),
    });

    const { container } = render(<AICEOAyra />);
    const purpleBanner = screen.getByRole("heading", { name: "ceo.ayra_title" });
    const capabilityList = screen.getByText("ceo.ayra_can");

    expect(container.querySelectorAll('[data-testid="ayra-world-banner"]')).toHaveLength(0);
    expect(
      purpleBanner.compareDocumentPosition(capabilityList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("ceo.ayra_cannot")).toBeTruthy();
    expect(screen.getByText("ceo.ayra_orders")).toBeTruthy();
  });

  it("keeps the AYRA loading state on the sub-page", () => {
    mocks.useAyraCapabilities.mockReturnValue({
      capabilities: [],
      connected: 0,
      notConnected: 0,
      isLoading: true,
      failed: false,
      denied: false,
      refetch: vi.fn(),
    });
    mocks.useAyraOrders.mockReturnValue({
      orders: [],
      degraded: [],
      isLoading: true,
      failed: false,
      denied: false,
      refetch: vi.fn(),
    });

    render(<AICEOAyra />);

    expect(screen.queryByTestId("ayra-world-banner")).toBeNull();
    expect(screen.getByText("ceo.ayra_loading")).toBeTruthy();
  });
});
