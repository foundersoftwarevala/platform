import { afterEach, describe, expect, it, vi } from "vitest";
import { answer } from "@/routes/api/marketplace/search";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("database-backed homepage search", () => {
  it("pages catalogue matches beyond the first 200 and applies the selected category", async () => {
    vi.stubEnv("SUPABASE_URL", "https://catalogue.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const target = String(input);
        requests.push(target);
        if (target.includes("marketplace_categories")) {
          return Response.json([{ id: "category-123" }]);
        }
        return new Response(
          JSON.stringify([
            {
              id: "product-301",
              slug: "product-301",
              name: "Product 301",
              visible: true,
              content_status: "published",
            },
          ]),
          { headers: { "content-range": "280-280/301" } },
        );
      }),
    );

    const response = await answer(
      new Request(
        "https://softwarevala.net/api/marketplace/search?q=product&category=retail-pos&format=cards&limit=40&offset=280",
      ),
    );
    const payload = await response.json();
    const productRequest = requests.find((target) => target.includes("marketplace_products"));

    expect(response.status).toBe(200);
    expect(productRequest).toContain("category_id=eq.category-123");
    expect(productRequest).toContain("offset=280");
    expect(productRequest).toContain("limit=40");
    expect(payload).toMatchObject({
      total: 301,
      offset: 280,
      hasMore: true,
      cards: [{ id: "product-301", slug: "product-301" }],
    });
  });

  it("does not silently search all categories when category resolution fails", async () => {
    vi.stubEnv("SUPABASE_URL", "https://catalogue.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("database unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await answer(
      new Request(
        "https://softwarevala.net/api/marketplace/search?q=retail&category=retail-pos&format=cards",
      ),
    );

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
