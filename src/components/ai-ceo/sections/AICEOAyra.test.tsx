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
}));

describe("AICEOAyra page banner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders exactly one hero before the existing capability lists", () => {
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
    const hero = screen.getByTestId("ayra-hero-banner");
    const capabilityList = screen.getByText("ceo.ayra_can");

    expect(container.querySelectorAll('[data-testid="ayra-hero-banner"]')).toHaveLength(1);
    expect(
      hero.compareDocumentPosition(capabilityList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("ceo.ayra_cannot")).toBeTruthy();
    expect(screen.getByText("ceo.ayra_orders")).toBeTruthy();
  });

  it("keeps the hero visible while the VPS capability data is loading", () => {
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

    expect(screen.getAllByTestId("ayra-hero-banner")).toHaveLength(1);
    expect(screen.getByText("ceo.ayra_loading")).toBeTruthy();
  });
});
