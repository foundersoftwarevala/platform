import { afterEach, expect, it, vi } from "vitest";
import { AiMeteringError, aiComplete } from "@/lib/ai-gateway.server";
import { generateLocalJson } from "@/lib/founder/local-ollama.server";
import { activateDemo, investigateDemo, listProcessedDemos, publishDemo } from "./process.server";
import { safeFetch } from "./safe-fetch.server";

vi.mock("@/lib/ai-gateway.server", () => {
  class MockAiMeteringError extends Error {
    constructor() {
      super("AI usage recording failed");
      this.name = "AiMeteringError";
    }
  }
  return {
    aiComplete: vi.fn().mockRejectedValue(new Error("OpenAI temporary outage")),
    AiMeteringError: MockAiMeteringError,
  };
});
vi.mock("@/lib/founder/local-ollama.server", () => ({
  generateLocalJson: vi.fn().mockRejectedValue(new Error("Local Ollama temporary outage")),
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

it("reads every canonical demo, including unprocessed rows, in stable numbered order", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
  const first = Array.from({ length: 500 }, (_, index) => ({ id: String(index) }));
  const second = [{ id: "500", processing_status: "unprocessed" }];
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      requests.push(url);
      return Response.json(url.searchParams.get("offset") === "0" ? first : second);
    }),
  );
  const rows = await listProcessedDemos();
  expect(rows).toHaveLength(501);
  expect(rows.at(-1)).toEqual(second[0]);
  expect(requests.map((url) => url.searchParams.get("offset"))).toEqual(["0", "500"]);
  for (const url of requests) {
    expect(url.searchParams.get("order")).toBe("sort_order.asc,id.asc");
    expect(url.searchParams.has("processing_status")).toBe(false);
    expect(url.searchParams.get("select")).not.toMatch(/username|password/);
  }
});

it("rejects an incomplete inventory instead of returning a success-shaped partial list", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) =>
      new URL(input).searchParams.get("offset") === "0"
        ? Response.json(Array.from({ length: 500 }, (_, index) => ({ id: String(index) })))
        : new Response("Unavailable", { status: 503 }),
    ),
  );
  await expect(listProcessedDemos()).rejects.toThrow("Database read failed (503)");
});

it.each([
  { blank: false, message: "Local Ollama temporary outage" },
  { blank: true, message: "unbuilt starter landing page" },
  { blank: false, message: "AI usage recording failed", meteringFailure: true },
])(
  "refuses publication without deleting the existing live record: $message",
  async ({ blank, message, meteringFailure = false }) => {
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
    if (meteringFailure) {
      vi.mocked(aiComplete).mockRejectedValueOnce(new AiMeteringError());
      vi.mocked(generateLocalJson).mockClear();
    }
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

    if (blank) {
      vi.mocked(safeFetch).mockResolvedValueOnce({
        ...(await safeFetch(row.url)),
        body: "<h1>Welcome to Your Blank App</h1><p>Start building your amazing project here!</p>",
      });
    }
    await expect(
      publishDemo({
        productId: product.id,
        url: row.url,
        actor: { id: null, email: null },
      }),
    ).rejects.toThrow(message);
    if (meteringFailure) expect(generateLocalJson).not.toHaveBeenCalled();
    expect(row.status).toBe("active");
    expect(row.processing_status).toBe("failed");
    expect(row.processing.rules).toEqual(rules);
    expect(row.processing.verification).toEqual({ ok: true });
    expect(writes).toHaveLength(2);
  },
);

it("uses the validated local Ollama result when the configured provider is unavailable", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
  const product = {
    id: "030420be-2499-496a-945a-9065b5a58364",
    name: "Nursing Training Institute",
    slug: "nursing-training-institute",
    category_id: "4c39f027-3383-4ce7-b660-2608cadcf7f1",
  };
  const category = { id: product.category_id, slug: "education", name: "Education" };
  const demo = {
    id: "e5e41e27-000b-4f57-b79e-4a88f4ff7376",
    product_id: product.id,
    demo_name: product.name,
    url: "https://health-prep-forge.lovable.app/",
    status: "inactive",
    sort_order: 0,
    processing_status: "investigating",
  };
  let row: Record<string, unknown> = demo;
  vi.mocked(generateLocalJson).mockResolvedValueOnce({
    model: "qwen2.5:3b",
    value: {
      software_name: product.name,
      summary: "Nursing training software.",
      category_slug: "education",
      category_reason: "Training content.",
      confidence: 0.9,
      contacts_to_remove: [
        { value: "info@nursinginstitute.edu", kind: "email", reason: "Public contact" },
      ],
      developer_branding: [],
      developer_links: [],
      logo_images: [],
      kept: [],
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const resource = url.pathname.split("/").at(-1);
      if (resource === "marketplace_products") return Response.json([product]);
      if (resource === "product_demo_urls") {
        if (init?.method === "POST") {
          row = { ...demo, ...JSON.parse(String(init.body)) };
          return Response.json([row]);
        }
        if (init?.method === "PATCH") {
          row = { ...row, ...JSON.parse(String(init.body)) };
          return Response.json([row]);
        }
        return Response.json([]);
      }
      if (resource === "marketplace_categories") return Response.json([category]);
      if (resource === "demo_url_audit_log") return Response.json([{}]);
      throw new Error(`Unexpected test request: ${resource}`);
    }),
  );

  const result = await investigateDemo({
    productId: product.id,
    url: demo.url,
    actor: { id: null, email: null },
  });

  expect(result.processing_status).toBe("review");
  expect(result.processing).toMatchObject({
    ai: { service: "Local Ollama", model: "qwen2.5:3b" },
    identity: { category_slug: "education" },
  });
  expect(generateLocalJson).toHaveBeenCalledOnce();
});

it("refuses activation until the detected demo category matches the product category", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
  vi.mocked(safeFetch).mockClear();
  const productId = "030420be-2499-496a-945a-9065b5a58364";
  const categoryId = "4c39f027-3383-4ce7-b660-2608cadcf7f1";
  const row = {
    id: "e5e41e27-000b-4f57-b79e-4a88f4ff7376",
    product_id: productId,
    url: "https://health-prep-forge.lovable.app/",
    status: "inactive",
    processing_status: "review",
    detected_category_id: null,
    processing: { rules: { remove: [], rebrand: [], logos: [], links: [] } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      const resource = url.pathname.split("/").at(-1);
      if (resource === "product_demo_urls") return Response.json([row]);
      if (resource === "marketplace_products") {
        return Response.json([
          {
            id: productId,
            name: "Nursing Training Institute",
            category_id: categoryId,
            visible: true,
            moderation_status: "approved",
          },
        ]);
      }
      if (resource === "marketplace_categories") return Response.json([{ name: "Education" }]);
      if (resource === "demo_url_audit_log") return Response.json([{}]);
      throw new Error(`Unexpected test request: ${resource}`);
    }),
  );

  await expect(activateDemo({ id: row.id, actor: { id: null, email: null } })).rejects.toThrow(
    "not category-verified",
  );
  expect(safeFetch).not.toHaveBeenCalled();
});
