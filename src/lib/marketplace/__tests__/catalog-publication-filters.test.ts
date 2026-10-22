import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const productId = "11111111-1111-4111-8111-111111111111";

describe("server-role catalogue publication filters", () => {
  const requests: URL[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const requestUrl = new URL(String(input));
        requests.push(requestUrl);

        if (requestUrl.pathname.endsWith("/marketplace_categories")) {
          return Response.json([{ id: "category-1", name: "Category", slug: "category" }]);
        }
        if (requestUrl.pathname.endsWith("/marketplace_row_config")) {
          return Response.json([]);
        }
        if (requestUrl.pathname.endsWith("/product_demo_urls")) {
          return Response.json([]);
        }
        if (requestUrl.pathname.endsWith("/marketplace_products")) {
          return Response.json(
            requestUrl.searchParams.get("select") === "id"
              ? [{ id: productId }]
              : [
                  {
                    id: productId,
                    slug: "published-product",
                    name: "Published product",
                    product_demo_urls: [],
                  },
                ],
          );
        }
        return Response.json([]);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("filters service-role product reads by approval, visibility, publication, and schedule", async () => {
    const { readCategoryRow } = await import("../catalog.server");
    const result = await readCategoryRow("category", 0, 12);

    expect(result?.cards).toHaveLength(1);
    const productReads = requests.filter((request) =>
      request.pathname.endsWith("/marketplace_products"),
    );
    expect(productReads).toHaveLength(2);

    for (const request of productReads) {
      expect(request.searchParams.get("moderation_status")).toBe("eq.approved");
      expect(request.searchParams.get("visible")).toBe("eq.true");
      expect(request.searchParams.get("content_status")).toBe("eq.published");
      expect(request.searchParams.get("and")).toMatch(
        /^\(or\(publish_at\.is\.null,publish_at\.lte\..+\),or\(unpublish_at\.is\.null,unpublish_at\.gt\..+\)\)$/,
      );
    }
  });
});
