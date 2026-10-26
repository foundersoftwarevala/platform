// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AyraHeroBanner } from "./AyraHeroBanner";

const mocks = vi.hoisted(() => ({
  streamChat: vi.fn(),
}));

vi.mock("@/components/vala-ai/chat-stream", () => ({
  streamChat: mocks.streamChat,
}));

vi.mock("@/components/JarvisCore", () => ({
  JarvisCore: () => <div aria-label="AYRA avatar" />,
}));

describe("AyraHeroBanner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders one hero with the Ask AYRA field and quick actions", () => {
    render(<AyraHeroBanner connected={4} notConnected={2} />);

    expect(screen.getAllByTestId("ayra-hero-banner")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Meet AYRA" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Ask AYRA...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeTruthy();
    expect(screen.getByText("4 connected capabilities · 2 not connected")).toBeTruthy();
  });

  it("sends the typed prompt to the existing chat stream and shows its reply", async () => {
    mocks.streamChat.mockImplementation(async (_messages, options) => {
      options.onDelta?.("A grounded next step.");
      return "A grounded next step.";
    });
    render(<AyraHeroBanner connected={4} notConnected={2} />);

    fireEvent.change(screen.getByPlaceholderText("Ask AYRA..."), {
      target: { value: "What should I prioritize?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message to AYRA" }));

    await waitFor(() => {
      expect(screen.getByText("A grounded next step.")).toBeTruthy();
    });
    expect(mocks.streamChat).toHaveBeenCalledWith(
      [{ role: "user", content: "What should I prioritize?" }],
      expect.objectContaining({ signal: expect.any(AbortSignal), onDelta: expect.any(Function) }),
    );
  });

  it("surfaces chat failures instead of hiding them", async () => {
    mocks.streamChat.mockRejectedValue(new Error("Chat unavailable"));
    render(<AyraHeroBanner connected={4} notConnected={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Chat unavailable");
  });
});
