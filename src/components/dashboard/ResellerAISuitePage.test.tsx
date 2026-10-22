// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("@/lib/reseller-dashboard.functions", () => ({
  generateResellerAi: mocks.generate,
}));

import { ResellerAISuitePage } from "./ResellerAISuitePage";

afterEach(() => {
  cleanup();
  mocks.generate.mockReset();
});

describe("Reseller AI Suite", () => {
  it("sends the selected tool and user prompt, shows loading, then renders the gateway output", async () => {
    let resolveGeneration!: (result: { text: string; model: string | null }) => void;
    mocks.generate.mockImplementation(
      () => new Promise((resolve) => { resolveGeneration = resolve; }),
    );
    render(<ResellerAISuitePage onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /AI Email Generator/ }));
    fireEvent.change(screen.getByPlaceholderText("Re-engage a trial client who went dark for 14 days"), {
      target: { value: "Write a friendly trial follow-up." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByText("Generating with AI…")).toBeTruthy();
    expect(mocks.generate).toHaveBeenCalledWith({
      data: { tool: "email", input: "Write a friendly trial follow-up." },
    });
    resolveGeneration({ text: "Subject: Checking in\nWould a short demo help?", model: "qwen-local" });

    expect(await screen.findByText(/Subject: Checking in/)).toBeTruthy();
    expect(screen.getByText("Model: qwen-local")).toBeTruthy();
  });

  it("shows provider failures rather than replacing them with preview text", async () => {
    mocks.generate.mockRejectedValue(new Error("No usable free-or-lower-cost AI service could be used."));
    render(<ResellerAISuitePage onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /AI Lead Scoring/ }));
    fireEvent.change(screen.getByPlaceholderText("Paste lead notes, company info or CRM dump"), {
      target: { value: "A small education company evaluating an annual plan." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No usable free-or-lower-cost AI service could be used.",
    );
    expect(screen.getByRole("button", { name: "Generate" }).hasAttribute("disabled")).toBe(false);
  });
});
