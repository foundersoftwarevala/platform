// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBossSuggestions: vi.fn(),
  acknowledgeSuggestion: vi.fn(),
  suggestions: [] as never[],
}));

vi.mock("@/hooks/useCEOSuggestions", () => ({
  useCEOSuggestions: () => ({
    getBossSuggestions: mocks.getBossSuggestions,
    acknowledgeSuggestion: mocks.acknowledgeSuggestion,
    isDeciding: false,
    degraded: [],
    suggestions: mocks.suggestions,
  }),
}));

vi.mock("./GovernedApprovals", () => ({
  GovernedApprovals: () => null,
}));

import AICEOApprovals from "./AICEOApprovals";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AI CEO Boss approval queue", () => {
  it("shows a retryable error instead of presenting a failed read as an empty queue", async () => {
    mocks.getBossSuggestions
      .mockRejectedValueOnce(new Error("VPS approval store unavailable"))
      .mockResolvedValueOnce([]);

    render(<AICEOApprovals />);

    expect(await screen.findByText("Approval queue unavailable")).toBeTruthy();
    expect(screen.getByText(/VPS approval store unavailable/)).toBeTruthy();
    expect(screen.queryByText("Nothing waiting for you")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Nothing waiting for you")).toBeTruthy());
    expect(mocks.getBossSuggestions).toHaveBeenCalledTimes(2);
  });
});
