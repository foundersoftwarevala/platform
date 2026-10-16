// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reject: vi.fn() }));
vi.mock("@/lib/marketplace-manager/aicontent.functions", () => ({
  getAiContentConsole: vi.fn(async () => ({
    ok: true,
    rows: [
      {
        id: "content-fixture",
        content_type: "summary",
        status: "GENERATED",
        legal_state: "CLEARED",
        provenance: "AI_GENERATED",
        duplicate_state: "UNCHECKED",
        content: "Fixture content",
        version: 1,
      },
    ],
    queue: [
      {
        id: "content-fixture",
        product: "Fixture product",
        content_type: "summary",
        validation_state: "PASSED",
        legal_state: "CLEARED",
      },
    ],
  })),
  getAiContentProducts: vi.fn(async () => ({ ok: true, rows: [] })),
  rejectContent: mocks.reject,
}));
import { AiContentGenerator } from "./AiContentGenerator";

afterEach(cleanup);
beforeEach(() => {
  mocks.reject.mockReset().mockResolvedValue({ ok: true });
});

function open() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AiContentGenerator />
    </QueryClientProvider>,
  );
}

describe("AI content rejection payload", () => {
  it.each(["Generate", "Review queue"])(
    "submits item_id, reason and rejection code from %s",
    async (tab) => {
      open();
      await screen.findByText("Fixture content");
      if (tab !== "Generate") fireEvent.click(screen.getByRole("button", { name: tab }));
      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(
        screen.getByPlaceholderText(tab === "Generate" ? "What exactly is wrong?" : "Reason"),
        { target: { value: "Incorrect fixture information" } },
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: tab === "Generate" ? "Reject" : "Confirm",
        }),
      );
      await waitFor(() =>
        expect(mocks.reject).toHaveBeenCalledWith({
          data: {
            item_id: "content-fixture",
            code: "incorrect_information",
            reason: "Incorrect fixture information",
          },
        }),
      );
      expect(
        await screen.findByText("Rejected. The content and the reason are kept."),
      ).toBeTruthy();
    },
  );

  it("keeps server rejection failures visible", async () => {
    mocks.reject.mockRejectedValue(new Error("Fixture permission refused"));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Fixture permission refused")).toBeTruthy();
  });
});
