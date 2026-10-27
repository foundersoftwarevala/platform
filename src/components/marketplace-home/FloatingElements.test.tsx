// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FloatingElement } from "@/lib/storefront/chrome.functions";

const mocks = vi.hoisted(() => ({
  elements: [] as FloatingElement[],
  auth: { user: null as null | { id: string }, isLoading: false },
}));
vi.mock("@/lib/marketplace/home-route-data", () => ({
  useHomeRouteData: () => ({ chrome: { floating: { published: true, elements: mocks.elements } } }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/marketplace/attribution", () => ({ currentAttribution: () => ({}) }));
import { FloatingElements } from "./FloatingElements";
import { getFloatingScope } from "./floating-scope";

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
  mocks.auth = { user: null, isLoading: false };
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
    mocks.elements[0].trigger_value = 3000;
    vi.useFakeTimers();
    const view = render(<FloatingElements />);
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    view.unmount();
    const pending = render(<FloatingElements />);
    expect(vi.getTimerCount()).toBe(1);
    pending.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts the trigger when a published trigger setting changes", () => {
    vi.useFakeTimers();
    const immediate = { ...fixture("immediate") };
    const view = render(<FloatingElements snapshot={{ published: true, elements: [immediate] }} />);
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();

    const delayed = { ...immediate, trigger: "delay" as const, trigger_value: 3000 };
    view.rerender(<FloatingElements snapshot={{ published: true, elements: [delayed] }} />);
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
  });

  it("shows a scroll widget on a page too short to scroll and removes its listener", () => {
    mocks.elements = [fixture("scroll")];
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<FloatingElements />);
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("shows a scroll widget when the configured percentage is reached", () => {
    mocks.elements = [fixture("scroll")];
    mocks.elements[0].trigger_value = 35;
    const root = document.documentElement;
    const descriptors = ["scrollHeight", "clientHeight", "scrollTop"].map(
      (key) => [key, Object.getOwnPropertyDescriptor(root, key)] as const,
    );
    Object.defineProperties(root, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    try {
      render(<FloatingElements />);
      expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();
      root.scrollTop = 175;
      fireEvent.scroll(window);
      expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
    } finally {
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(root, key, descriptor);
        else Reflect.deleteProperty(root, key);
      }
    }
  });

  it("applies audience rules after authentication has loaded", () => {
    const element = { ...fixture("immediate"), audience: "authenticated" as const };
    const snapshot = { published: true, elements: [element] };
    mocks.auth = { user: null, isLoading: true };
    const view = render(<FloatingElements snapshot={snapshot} />);
    expect(screen.queryByRole("link", { name: "Fixture widget" })).toBeNull();

    mocks.auth = { user: { id: "visitor" }, isLoading: false };
    view.rerender(<FloatingElements snapshot={snapshot} />);
    expect(screen.getByRole("link", { name: "Fixture widget" })).toBeTruthy();
  });

  it("uses the action target from the published snapshot", () => {
    const snapshot = {
      published: true,
      elements: [{ ...fixture("immediate"), target: "/custom-demo-route" }],
    };
    render(<FloatingElements snapshot={snapshot} />);
    expect(screen.getByRole("link", { name: "Fixture widget" }).getAttribute("href")).toBe(
      "/custom-demo-route",
    );
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

describe("floating page scopes", () => {
  it.each([
    ["/", "home"],
    ["/marketplace/", "home"],
    ["/marketplace/country/usa", "marketplace"],
    ["/marketplace/product/demo", "product"],
    ["/marketplace/category/education", "category"],
    ["/marketplace/education/usa", "category"],
    ["/ai/assistant", "other"],
  ] as const)("maps %s to %s", (pathname, scope) => {
    expect(getFloatingScope(pathname)).toBe(scope);
  });
});
