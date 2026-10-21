// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveTable } from "./LiveTable";
import { filterSchema } from "./sectionRegistry";

vi.mock("@/lib/auth/operator-fetch", () => ({ authHeaders: async () => ({}) }));

describe("Marketplace Manager deep-link filters", () => {
  const requests: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return Response.json({
      label: "Products",
      columns: ["id", "name", "content_status", "moderation_status", "created_at"],
      editable: [],
      rows: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
  });

  beforeEach(() => {
    requests.length = 0;
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/marketplace-manager?section=Products&status=draft");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(Object.keys(filterSchema))(
    "%s supports direct URL, refresh, history, invalid fallback, and no-filter default",
    async (section) => {
      window.history.replaceState(
        {},
        "",
        `/marketplace-manager?section=${encodeURIComponent(section)}&status=draft`,
      );
      const first = render(<LiveTable section={section} resource="products" />);
      await waitFor(() =>
        expect(requests.at(-1)).toContain("filter=content_status.eq.draft"),
      );
      first.unmount();

      render(<LiveTable section={section} resource="products" />);
      await waitFor(() => expect(requests.filter((url) => url.includes("status.eq.draft")).length).toBeGreaterThan(1));

      let previousCount = requests.length;
      window.history.pushState(
        {},
        "",
        `/marketplace-manager?section=${encodeURIComponent(section)}&status=published`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
      await waitFor(() =>
        expect(requests.slice(previousCount).at(-1)).toContain("filter=content_status.eq.published"),
      );

      previousCount = requests.length;
      window.history.back();
      await waitFor(() =>
        expect(requests.slice(previousCount).at(-1)).toContain("filter=content_status.eq.draft"),
      );
      previousCount = requests.length;
      window.history.forward();
      await waitFor(() =>
        expect(requests.slice(previousCount).at(-1)).toContain("filter=content_status.eq.published"),
      );

      previousCount = requests.length;
      window.history.pushState(
        {},
        "",
        `/marketplace-manager?section=${encodeURIComponent(section)}&status=invalid`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
      await waitFor(() => expect(requests.length).toBeGreaterThan(previousCount));
      expect(requests.slice(previousCount).at(-1)).not.toContain("filter=");

      previousCount = requests.length;
      window.history.pushState(
        {},
        "",
        `/marketplace-manager?section=${encodeURIComponent(section)}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
      await waitFor(() => expect(requests.length).toBeGreaterThan(previousCount));
      expect(requests.slice(previousCount).at(-1)).not.toContain("filter=");
    },
  );

  it.each(["Dashboard", "Analytics", "Orders"])(
    "ignores arbitrary filters without mutating the URL for non-queue %s",
    async (section) => {
      const search =
        `?section=${encodeURIComponent(section)}&status=invalid&custom=keep&range=forever`;
      window.history.replaceState({}, "", `/marketplace-manager${search}`);
      const before = window.location.search;

      render(<LiveTable section={section} resource="orders" />);
      await waitFor(() => expect(requests.length).toBeGreaterThan(0));

      expect(requests.at(-1)).not.toContain("filter=");
      expect(window.location.search).toBe(before);
    },
  );
});
