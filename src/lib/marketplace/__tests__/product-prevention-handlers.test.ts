import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({
  author: vi.fn(),
  rest: vi.fn(),
  operator: vi.fn(),
  decisions: vi.fn(),
  prints: vi.fn(),
}));
vi.mock("@/lib/marketplace/author-guard", async (original) => ({
  ...(await original<typeof import("../author-guard")>()),
  requireAuthor: mocks.author,
  rest: mocks.rest,
}));
vi.mock("@/lib/auth/internal-guard", () => ({ requireInternalOperator: mocks.operator }));
vi.mock("@/lib/seo/seo-store.server", () => ({
  upsertDecisions: mocks.decisions,
  upsertFingerprints: mocks.prints,
  allDecisionStates: async () => [],
  storeOwns: () => false,
  readResourceRows: vi.fn(),
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  catalogueChanged: vi.fn(),
  STOREFRONT_TABLES: new Set(["marketplace_products"]),
}));

import { Route as AuthorRoute } from "@/routes/api/author/products";
import { Route as ManagerRoute } from "@/routes/api/manager/resource";
import { Route as GateRoute } from "@/routes/api/internal/seo-gate";
import { upsertReviewedProduct } from "../product-write.server";

type Post = (ctx: { request: Request }) => Promise<Response>;
type PostOptions = { server: { handlers: { POST: Post } } };
const authorPost = (AuthorRoute.options as typeof AuthorRoute.options & PostOptions).server.handlers
  .POST;
const managerPost = (ManagerRoute.options as typeof ManagerRoute.options & PostOptions).server
  .handlers.POST;
const gatePost = (GateRoute.options as typeof GateRoute.options & PostOptions).server.handlers.POST;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const request = (path: string, body: unknown) =>
  new Request(`https://softwarevala.net${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.author.mockResolvedValue({ ok: true, seller: { id: "seller1" }, user: { id: "u1" } });
  mocks.operator.mockResolvedValue({ ok: true, via: "internal token" });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("actual product creation handlers", () => {
  it("author creation cannot override QA visibility or review state", async () => {
    mocks.rest.mockImplementation(async (_path: string, init: RequestInit) => {
      const row = JSON.parse(String(init.body));
      expect(row).toMatchObject({
        visible: false,
        content_status: "in_review",
        moderation_status: "submitted",
        seller_id: "seller1",
      });
      return json([{ id: "p1", ...row }]);
    });
    const response = await authorPost({
      request: request("/api/author/products", {
        name: "QA Product",
        visible: true,
        content_status: "published",
        moderation_status: "approved",
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ review: { review_required: true } });
    expect(console.warn).toHaveBeenCalled();
  });

  it("normal author products still start as hidden editable drafts", async () => {
    mocks.rest.mockImplementation(async (_path: string, init: RequestInit) => {
      const row = JSON.parse(String(init.body));
      expect(row).toMatchObject({
        visible: false,
        content_status: "draft",
        moderation_status: "draft",
      });
      return json([{ id: "p1", ...row }]);
    });
    const response = await authorPost({
      request: request("/api/author/products", { name: "School ERP" }),
    });
    expect(await response.json()).toMatchObject({ review: { review_required: false } });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("manager creation overrides caller visibility and records the review reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const row = JSON.parse(String(init?.body));
        if (String(input).includes("/rpc/mm_audit")) {
          expect(row.p_reason).toContain("QA/test");
          return json("audit1");
        }
        expect(row).toMatchObject({
          visible: false,
          content_status: "in_review",
          moderation_status: "submitted",
        });
        return json([{ id: "p1", ...row }]);
      }),
    );
    const response = await managerPost({
      request: request("/api/manager/resource", {
        resource: "products",
        values: {
          name: "Dummy ERP",
          slug: "dummy-erp",
          visible: true,
          content_status: "published",
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ review: { review_required: true } });
  });

  it.each([false, true])(
    "catalogue upsert guards only new products; existing=%s",
    async (existing) => {
      const write = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_input: string | URL, init?: RequestInit) => {
          if (init?.method === "POST") {
            const row = JSON.parse(String(init.body));
            write(row);
            return json({ id: "p1", ...row });
          }
          return json(existing ? [{ id: "p1" }] : []);
        }),
      );
      const client = createClient<Database>("http://db.test", "fixture", {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { retry: false },
      });
      await upsertReviewedProduct(client, {
        name: "Sample ERP",
        slug: "sample-erp",
        visible: true,
      });
      expect(write.mock.calls[0][0].visible).toBe(existing);
      expect(write.mock.calls[0][0].moderation_status).toBe(existing ? undefined : "submitted");
    },
  );

  it("catalogue lookup failures stop before writing", async () => {
    const write = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        if (init?.method === "POST") write();
        return json({ message: "database unavailable" }, 503);
      }),
    );
    const client = createClient<Database>("http://db.test", "fixture", {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { retry: false },
    });
    await expect(upsertReviewedProduct(client, { name: "QA ERP", slug: "qa-erp" })).rejects.toThrow(
      "database unavailable",
    );
    expect(write).not.toHaveBeenCalled();
  });

  it("a concurrent QA slug conflict cannot overwrite an existing product", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (init?.method !== "POST") return json([]);
        expect(new URL(String(input)).searchParams.has("on_conflict")).toBe(false);
        expect(new Headers(init.headers).get("prefer")).not.toContain("merge-duplicates");
        return json({ code: "23505", message: "slug already exists" }, 409);
      }),
    );
    const client = createClient<Database>("http://db.test", "fixture", {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { retry: false },
    });
    await expect(upsertReviewedProduct(client, { name: "QA ERP", slug: "qa-erp" })).rejects.toThrow(
      "slug already exists",
    );
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("actual slot gate inventory alignment", () => {
  it.each([
    { visible: false, content_status: "published" },
    { visible: true, content_status: "draft" },
  ])("records UNVERIFIED for a nonpublic occupied tenant: %j", async (tenant) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const link = String(input);
        if (link.includes("/rest/v1/marketplace_card_slots"))
          return json([
            {
              id: "s1",
              slot_url: "/marketplace/education/usa",
              country_marker: "USA",
              status: "occupied",
              current_product_id: "p1",
              marketplace_categories: { name: "Education" },
            },
          ]);
        if (link.includes("/rest/v1/marketplace_products"))
          return json([{ id: "p1", name: "ERP", ...tenant }]);
        return new Response("<html><head></head><body>Education USA ERP</body></html>");
      }),
    );
    const response = await gatePost({
      request: request("/api/internal/seo-gate?kind=slot&limit=1", {}),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      evaluated: 1,
      eligible: 0,
      byState: { UNVERIFIED: 1 },
    });
    expect(mocks.decisions.mock.calls[0][0][0]).toMatchObject({
      state: "UNVERIFIED",
      sitemap_eligible: false,
    });
  });
});
