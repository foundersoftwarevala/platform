import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo/site-url", () => ({
  absoluteUrl: (path: string) => `https://softwarevala.net${path}`,
  indexable: () => true,
}));
vi.mock("@/lib/seo/sitemap-gate", () => ({
  eligibleUrls: vi.fn(async () => []),
}));

import { eligibleUrls } from "@/lib/seo/sitemap-gate";
import { Route as ProductRoute } from "@/routes/sitemap-products/$page";
import { Route as SlotRoute } from "@/routes/sitemap-slots/$page";

type RouteWithGet = {
  options: {
    server: {
      handlers: {
        GET: (context: { params: Record<string, string> }) => Promise<Response>;
      };
    };
  };
};

function getHandler(route: typeof ProductRoute | typeof SlotRoute) {
  return (route as unknown as RouteWithGet).options.server.handlers.GET;
}

describe("paged sitemap routes", () => {
  beforeEach(() => {
    vi.mocked(eligibleUrls).mockClear();
    vi.mocked(eligibleUrls).mockResolvedValue([]);
  });

  it.each([
    ["products", ProductRoute, "product"],
    ["slots", SlotRoute, "slot"],
  ] as const)("serves page-number XML routes for %s", async (_label, route, type) => {
    const response = await getHandler(route)({ params: { page: "2.xml" } });

    expect(response.status).toBe(200);
    expect(eligibleUrls).toHaveBeenCalledWith(type, 1000, 1000);
  });

  it.each([
    ["products", ProductRoute],
    ["slots", SlotRoute],
  ] as const)("rejects malformed page segments for %s", async (_label, route) => {
    const response = await getHandler(route)({ params: { page: "2.xml.backup" } });

    expect(response.status).toBe(404);
    expect(eligibleUrls).not.toHaveBeenCalled();
  });
});
