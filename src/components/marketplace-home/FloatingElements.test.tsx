// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FloatingElement } from "@/lib/storefront/chrome.functions";

const mocks = vi.hoisted(() => ({ elements: [] as FloatingElement[] }));
vi.mock("@/lib/marketplace/home-route-data", () => ({
  useHomeRouteData: () => ({ chrome: { floating: { published: true, elements: mocks.elements } } }),
}));
vi.mock("@/lib/marketplace/attribution", () => ({ currentAttribution: () => ({}) }));
import { FloatingElements } from "./FloatingElements";

function fixture(trigger: FloatingElement["trigger"]): FloatingElement {
  return {
    key: "fixture",
    type: "link",
    label: "Fixture widget",
    position: "bottom-right",
    offset_x: 0,
    offset_y: 0,
    theme: "accent",
    icon: null,
    priority: 1,
    desktop: true,
    tablet: true,
    mobile: true,
    trigger,
    trigger_value: 100,
    action: "route",
    target: "/marketplace",
    audience: "all",
    scope: "home",
  };
}
beforeEach(() => {
  mocks.elements = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("floating trigger lifecycle", () => {
  it("shows an immediate widget without registering timers", () => {
    mocks.elements = [fixture("immediate")];
    vi.useFakeTimers();
    render(<FloatingElements />);
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows a delayed widget at its threshold and clears a pending timer on unmount", () => {
    mocks.elements = [fixture("delay")];
    vi.useFakeTimers();
    const view = render(<FloatingElements />);
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(99));
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    view.unmount();
    const pending = render(<FloatingElements />);
    expect(vi.getTimerCount()).toBe(1);
    pending.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows a scroll widget on a page too short to scroll and removes its listener", () => {
    mocks.elements = [fixture("scroll")];
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<FloatingElements />);
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("shows an exit-intent widget only on exit and removes its listener", () => {
    mocks.elements = [fixture("exit_intent")];
    const remove = vi.spyOn(document, "removeEventListener");
    const view = render(<FloatingElements />);
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    fireEvent.mouseOut(document, { clientY: 20 });
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    fireEvent.mouseOut(document, { clientY: 0 });
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("mouseout", expect.any(Function));
  });
});
