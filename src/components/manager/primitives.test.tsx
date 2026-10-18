// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlassCard } from "./primitives";

afterEach(cleanup);

describe("GlassCard", () => {
  it("preserves the title, icon, body padding and custom classes", () => {
    const { container } = render(
      <GlassCard
        title="Overview"
        icon={<span data-testid="card-icon">Icon</span>}
        className="custom-card"
      >
        <p>Existing content</p>
      </GlassCard>,
    );

    expect(screen.getByRole("heading", { name: "Overview", level: 2 })).toBeTruthy();
    expect(screen.getByTestId("card-icon")).toBeTruthy();
    expect(container.querySelector("section")?.classList.contains("panel")).toBe(true);
    expect(container.querySelector("section")?.classList.contains("custom-card")).toBe(true);
    expect(screen.getByText("Existing content").parentElement?.classList.contains("p-5")).toBe(
      true,
    );
  });

  it("renders an interactive action beside the title and a ReactNode description below it", () => {
    const refresh = vi.fn();
    const { container } = render(
      <GlassCard
        title="Overview"
        description={
          <p>
            Review <strong>current work</strong>
          </p>
        }
        actions={
          <button type="button" onClick={refresh}>
            Refresh
          </button>
        }
      >
        <p>Card content</p>
      </GlassCard>,
    );
    const header = container.querySelector(".border-b");
    const action = screen.getByRole("button", { name: "Refresh" });

    expect(header?.contains(screen.getByRole("heading", { name: "Overview" }))).toBe(true);
    expect(header?.contains(screen.getByText("current work"))).toBe(true);
    expect(header?.contains(action)).toBe(true);
    expect(header?.contains(screen.getByText("Card content"))).toBe(false);
    expect(container.querySelector("p p")).toBeNull();
    fireEvent.click(action);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("renders a description without requiring a title", () => {
    render(
      <GlassCard description="Helpful context">
        <p>Content</p>
      </GlassCard>,
    );

    expect(screen.getByText("Helpful context")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders actions without requiring a title", () => {
    render(
      <GlassCard actions={<button type="button">Export</button>}>
        <p>Content</p>
      </GlassCard>,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders zero-valued ReactNodes instead of dropping them", () => {
    const { container } = render(
      <GlassCard description={0} actions={0}>
        <p>Content</p>
      </GlassCard>,
    );

    expect(container.querySelector(".border-b")?.textContent).toBe("00");
  });

  it("does not add a header to a content-only card", () => {
    const { container } = render(
      <GlassCard>
        <p>Content</p>
      </GlassCard>,
    );

    expect(container.querySelector(".border-b")).toBeNull();
    expect(screen.getByText("Content")).toBeTruthy();
  });

  it("does not add a header for null optional props", () => {
    const { container } = render(
      <GlassCard description={null} actions={null}>
        <p>Content</p>
      </GlassCard>,
    );

    expect(container.querySelector(".border-b")).toBeNull();
  });

  it("removes optional header content when the caller clears it", () => {
    const { container, rerender } = render(
      <GlassCard title="Overview" description="Context" actions={<button>Refresh</button>}>
        <p>Content</p>
      </GlassCard>,
    );
    rerender(
      <GlassCard>
        <p>Content</p>
      </GlassCard>,
    );

    expect(container.querySelector(".border-b")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Context")).toBeNull();
    expect(screen.getByText("Content")).toBeTruthy();
  });
});
