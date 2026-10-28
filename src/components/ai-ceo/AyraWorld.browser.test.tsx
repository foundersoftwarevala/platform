// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const autofill = vi.hoisted(() => ({
  run: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => autofill.run,
}));
vi.mock("@/lib/ai-ceo/ayra-autofill.functions", () => ({
  autoFillAyraCompanyForm: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: autofill.toast }));

import { BrowserPanel } from "./AyraWorld";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  autofill.run.mockReset();
  autofill.toast.info.mockReset();
  autofill.toast.error.mockReset();
  autofill.toast.success.mockReset();
});

describe("AYRA workspace browser shortcuts", () => {
  it("loads shortcuts inside the panel and offers explicit external fallback", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<BrowserPanel onRun={vi.fn()} reply="" busy={false} />);

    fireEvent.click(screen.getByRole("button", { name: /YouTube/ }));
    const frame = screen.getByTitle("External page www.youtube.com") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.youtube.com/");
    expect(
      screen.getByText(/Auto-Fill only reads same-origin forms.*Cross-origin pages cannot be inspected/),
    ).toBeTruthy();
    expect(open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open separately" }));
    expect(open).toHaveBeenCalledWith("https://www.youtube.com/", "_blank", "noopener,noreferrer");
  });

  it("offers Auto-Fill but does not inspect a cross-origin iframe", () => {
    render(<BrowserPanel onRun={vi.fn()} reply="" busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: /YouTube/ }));
    fireEvent.click(screen.getByRole("button", { name: "Auto-fill company details" }));
    expect(autofill.run).not.toHaveBeenCalled();
    expect(autofill.toast.error).toHaveBeenCalledWith(
      "Browser security prevents AYRA from reading forms on another website.",
      expect.objectContaining({ description: expect.stringContaining("same-origin pages") }),
    );
  });

  it("fills a same-origin form with returned company data and never submits it", async () => {
    const onRun = vi.fn();
    autofill.run.mockResolvedValue([
      { index: 0, profileFieldName: "company_name", value: "Software Vala" },
    ]);
    render(<BrowserPanel onRun={onRun} reply="" busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Automate" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Automation task" }), {
      target: { value: `Open ${window.location.origin}/onboarding` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run with AYRA" }));
    const frame = (await screen.findByTitle(
      `External page ${window.location.hostname}`,
    )) as HTMLIFrameElement;
    const page = document.implementation.createHTMLDocument("same-origin form");
    Object.defineProperty(page, "defaultView", { configurable: true, value: window });
    Object.defineProperty(frame, "contentDocument", { configurable: true, value: page });
    page.body.innerHTML = '<form><label for="company_name">Company Name</label><input id="company_name"></form>';
    const submit = vi.fn((event: Event) => event.preventDefault());
    page.querySelector("form")?.addEventListener("submit", submit);

    fireEvent.click(screen.getByRole("button", { name: "Auto-fill company details" }));
    await waitFor(() => expect(autofill.run).toHaveBeenCalledOnce());
    await waitFor(() => expect((page.querySelector("input") as HTMLInputElement).value).toBe("Software Vala"));
    expect(autofill.run).toHaveBeenCalledWith({
      data: {
        fields: [expect.objectContaining({ index: 0, id: "company_name", label: "Company Name" })],
      },
    });
    expect(submit).not.toHaveBeenCalled();
    expect(autofill.toast.success).toHaveBeenCalledWith(
      "Form filled with Software Vala details.",
      expect.objectContaining({ description: expect.stringContaining("Review them before submitting") }),
    );
  });

  it("keeps navigation in the iframe for Google searches", () => {
    render(<BrowserPanel onRun={vi.fn()} reply="" busy={false} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search Google" }), {
      target: { value: "Software Vala" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Google Search" }));
    const frame = screen.getByTitle("External page www.google.com") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.google.com/search?q=Software%20Vala");
  });
});
