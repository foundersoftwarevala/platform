// @vitest-environment jsdom
import { type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioBuilder } from "./StudioBuilder";

const generate = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: notifications }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => generate }));
vi.mock("@/lib/vala-ai/studio/ai/site.functions", () => ({ generateSiteFn: vi.fn() }));
vi.mock("../session", () => ({ useOperator: () => ({ id: "unit-owner" }) }));

beforeEach(() => {
  localStorage.clear();
  generate.mockReset();
  notifications.error.mockReset();
  notifications.warning.mockReset();
  generate.mockResolvedValue({
    title: "Unit website",
    html: "<html><head></head><body><h1>Unit website</h1></body></html>",
    reply: "Generated.",
  });
});
afterEach(cleanup);

describe("Studio Builder toolbar", () => {
  it("keeps controls sticky above the generated iframe without changing pointer events", () => {
    render(<StudioBuilder />);
    const toolbar = screen.getByRole("button", { name: "Code" }).closest("nav")?.parentElement;
    expect(toolbar?.classList.contains("sticky")).toBe(true);
    expect(toolbar?.classList.contains("top-0")).toBe(true);
    expect(toolbar?.classList.contains("z-20")).toBe(true);
    expect(toolbar?.classList.contains("shrink-0")).toBe(true);
    expect(toolbar?.className).not.toContain("pointer-events-none");
  });

  it("activates Code and enables download after every theme has been applied", async () => {
    render(<StudioBuilder />);
    fireEvent.change(screen.getByPlaceholderText("Describe what you want to build..."), {
      target: { value: "Build a unit website" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTitle("Website preview")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    for (const theme of [
      "Default",
      "Arctic",
      "Summer",
      "Fragrant",
      "Slate",
      "Feminine",
      "Forest",
      "Midnight",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${theme}`) }));
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
      expect(screen.getByText("Saved")).toBeTruthy();
    }
    const code = screen.getByRole("button", { name: "Code" });
    fireEvent.click(code);
    expect(code.classList.contains("font-semibold")).toBe(true);
    expect(document.querySelector("pre")?.textContent).toContain("#1d4ed8");
    expect(screen.getByRole("button", { name: "Download" }).hasAttribute("disabled")).toBe(false);
  }, 15000);

  it("passes an optional maximum and preserves over-limit output with an explicit warning", async () => {
    const html = "<html><head></head><body><h1>Unit website</h1></body></html>";
    const warning = "Warning: generated HTML exceeds the requested maximum.";
    generate.mockResolvedValue({ html, title: "Unit website", reply: "Generated.", warning });
    render(<StudioBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Maximum HTML characters/ }), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByPlaceholderText("Describe what you want to build..."), {
      target: { value: "Build a website" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(notifications.warning).toHaveBeenCalledWith(warning));
    expect(generate).toHaveBeenCalledWith({
      data: { request: "Build a website", maxCharacters: 20 },
    });
    await waitFor(() =>
      expect(localStorage.getItem("vala-studio-builder:unit-owner")).not.toBeNull(),
    );
    const saved = JSON.parse(localStorage.getItem("vala-studio-builder:unit-owner") || "null");
    expect(saved.html).toBe(html);
    expect(saved.maxCharacters).toBe("20");
    expect(saved.chat.at(-1).text).toContain(warning);
  });

  it("reports invalid limits without sending a model request", () => {
    render(<StudioBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Maximum HTML characters/ }), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Describe what you want to build..."), {
      target: { value: "Build a website" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(notifications.error).toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("shows a useful error instead of undefined.html when a generation returns no result", async () => {
    generate.mockResolvedValue(undefined);
    render(<StudioBuilder />);
    fireEvent.change(screen.getByPlaceholderText("Describe what you want to build..."), {
      target: { value: "Build a website" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("Website generation returned no HTML. Check the model and retry."),
    ).toBeTruthy();
  });
});
