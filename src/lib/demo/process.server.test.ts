import { afterEach, expect, it, vi } from "vitest";
import { publishDemo } from "./process.server";

vi.mock("@/lib/ai-gateway.server", () => ({
  aiComplete: vi.fn().mockRejectedValue(new Error("OpenAI temporary outage")),
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  catalogueChanged: vi.fn(),
}));
vi.mock("./safe-fetch.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./safe-fetch.server")>()),
  safeFetch: vi.fn().mockResolvedValue({
    body: "<!doctype html><html><head><title>Nursing Training Institute</title></head><body>Contact Us: info@nursinginstitute.edu</body></html>",
    url: "https://health-prep-forge.lovable.app/",
    contentType: "text/html",
    status: 200,
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("surfaces investigation failure and preserves the last valid presentation of a live demo", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
  const product = {
    id: "030420be-2499-496a-945a-9065b5a58364",
    name: "Nursing Training Institute",
    slug: "nursing-training-institute",
    category_id: "4c39f027-3383-4ce7-b660-2608cadcf7f1",
  };
  const rules = { remove: ["info@nursinginstitute.edu"], rebrand: [], logos: [], links: [] };
  let row = {
    id: "e5e41e27-000b-4f57-b79e-4a88f4ff7376",
    product_id: product.id,
    url: "https://health-prep-forge.lovable.app/",
    status: "active",
    sort_order: 0,
    processing_status: "live",
    processing: { rules, verification: { ok: true } },
  };
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const resource = url.pathname.split("/").at(-1);
      if (resource === "marketplace_products") return Response.json([product]);
      if (resource === "marketplace_categories")
        return Response.json([
          {
            id: product.category_id,
            slug: "education",
            name: "Education",
          },
        ]);
      if (resource === "demo_url_audit_log") return Response.json([{}]);
      if (resource === "product_demo_urls") {
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          writes.push(body);
          row = { ...row, ...body };
        }
        return Response.json([row]);
      }
      throw new Error(`Unexpected test request: ${resource}`);
    }),
  );

  await expect(
    publishDemo({
      productId: product.id,
      url: row.url,
      actor: { id: null, email: null },
    }),
  ).rejects.toThrow("OpenAI temporary outage");
  expect(row.status).toBe("active");
  expect(row.processing_status).toBe("failed");
  expect(row.processing.rules).toEqual(rules);
  expect(row.processing.verification).toEqual({ ok: true });
  expect(writes).toHaveLength(2);
});
