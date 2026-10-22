// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeoFrameworkTabs } from "./SeoFrameworkTabs";

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: (...args: unknown[]) => toastInfo(...args) } }));

describe("SEO framework tabs", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    toastInfo.mockClear();
  });

  it.each([
    ["backlinks-foundation", "Backlinks & Competitors", "Referring Domains"],
    ["technical-foundation", "Technical SEO", "Crawl Jobs"],
    ["keywords-foundation", "Keywords & Rankings", "Tracked Keywords"],
    ["local-phase2", "Local SEO", "Listings"],
    ["international-phase2", "International SEO", "Hreflang Maps"],
    ["reporting-phase2", "Reporting & Business", "SEO Reports"],
  ] as const)("renders an empty state for %s", (phase, title, section) => {
    render(<SeoFrameworkTabs phase={phase} />);

    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: section })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("No data available");
    expect(
      screen.getByRole("button", {
        name: /Refresh Data|Start Crawl|Sync Reviews|Generate Hreflang|Export Report/,
      }),
    ).toBeTruthy();
  });

  it("notifies instead of calling an API when refreshing data", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<SeoFrameworkTabs phase="backlinks-foundation" />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh Data" }));

    expect(toastInfo).toHaveBeenCalledWith("API Integration Pending. Connect API to run.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the pending notice for Start Crawl without starting a crawl", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<SeoFrameworkTabs phase="technical-foundation" />);

    fireEvent.click(screen.getByRole("button", { name: "Start Crawl" }));

    expect(toastInfo).toHaveBeenCalledWith("API Integration Pending. Connect API to run.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["local-phase2", "Reviews", "Sync Reviews"],
    ["international-phase2", "Hreflang Maps", "Generate Hreflang"],
    ["reporting-phase2", "SEO Reports", "Export Report"],
  ] as const)("keeps %s actions pending and network-free", (phase, section, action) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<SeoFrameworkTabs phase={phase} />);
    fireEvent.click(screen.getByRole("button", { name: section }));

    fireEvent.click(screen.getByRole("button", { name: action }));

    expect(toastInfo).toHaveBeenCalledWith("API Integration Pending. Connect API to run.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("switches subsections without issuing network requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<SeoFrameworkTabs phase="technical-foundation" />);

    fireEvent.click(screen.getByRole("button", { name: "Broken Links" }));

    expect(screen.getByRole("heading", { name: "Broken Links" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("No data available");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
