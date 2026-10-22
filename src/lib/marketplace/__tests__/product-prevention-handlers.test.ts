import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({
  author: vi.fn(),
  rest: vi.fn(),
  operator: vi.fn(),
  decisions: vi.fn(),
  prints: vi.fn(),
  snapshot: vi.fn(),
  saveRun: vi.fn(),
  catalogueChanged: vi.fn(),
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
  gateRunSnapshot: mocks.snapshot,
  saveGateRun: mocks.saveRun,
  allDecisionStates: async () => [],
  storeOwns: () => false,
  readResourceRows: vi.fn(),
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  catalogueChanged: mocks.catalogueChanged,
  STOREFRONT_TABLES: new Set(["marketplace_products"]),
}));

import { Route as AuthorRoute } from "@/routes/api/author/products";
import { Route as ManagerRoute } from "@/routes/api/manager/resource";
import { Route as GateRoute } from "@/routes/api/internal/seo-gate";
import { upsertReviewedProduct } from "../product-write.server";

type Post = (ctx: { request: Request }) => Promise<Response>;
type Get = (ctx: { request: Request }) => Promise<Response>;
type PostOptions = { server: { handlers: { POST: Post } } };
type GetOptions = { server: { handlers: { GET: Get } } };
const authorGet = (AuthorRoute.options as typeof AuthorRoute.options & GetOptions).server.handlers
  .GET;
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
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("actual product creation handlers", () => {
  it("returns the editable product fields and public category options for the author UI", async () => {
    const calls: string[] = [];
    mocks.rest.mockImplementation(async (path: string) => {
      calls.push(path);
      if (path.startsWith("marketplace_products")) {
        return json([
          {
            id: "p1",
            name: "Product",
            features: ["Reports"],
            tech_stack: ["React"],
            category_id: "c1",
            moderation_status: "draft",
          },
        ]);
      }
      return json([{ id: "c1", name: "Business" }]);
    });

    const response = await authorGet({
      request: new Request("https://softwarevala.net/api/author/products"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      products: [{ id: "p1", features: ["Reports"], tech_stack: ["React"] }],
      categories: [{ id: "c1", name: "Business" }],
    });
    expect(calls[0]).toContain("features");
    expect(calls[0]).toContain("search_keywords");
    expect(calls[1]).toContain("is_hidden=eq.false");
  });

  it.each(["dynamic", "provided-dynamic", "fallback", "fallback-pass", "unconfigured-failure"])(
    "gate dry-run %s uses dynamic expectations unless an explicit fallback is needed",
    async (scenario) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL) => {
          const url = String(input);
          if (url.includes("select=status,country_code"))
            return ["fallback", "fallback-pass", "unconfigured-failure"].includes(scenario)
              ? json({ error: "fixture unavailable" }, 503)
              : json([{ status: "occupied", country_code: "US" }]);
          if (url.includes("marketplace_card_slots"))
            return json([
              {
                id: "slot1",
                category_id: "cat1",
                slot_url: "/marketplace/education/usa",
                country_marker: "USA",
                status: "occupied",
                current_product_id: "p1",
                marketplace_categories: { name: "Education" },
              },
            ]);
          if (url.includes("marketplace_products"))
            return json([
              {
                id: "p1",
                name: "School ERP",
                visible: true,
                content_status: "published",
              },
            ]);
          return new Response(
            `<html><head><title>School ERP Education Software USA</title><link rel="alternate" hrefLang="en-US" href="/marketplace/education/usa"><link rel="alternate" hrefLang="x-default" href="/marketplace/education/usa"></head><body><h1>Education Software USA</h1>${Array.from({ length: 250 }, (_, i) => `module${i}`).join(" ")}</body></html>`,
            { status: 200 },
          );
        }),
      );
      const response = await gatePost({
        request: request(
          "/api/internal/seo-gate?kind=slot&dry_run=1" +
            (scenario === "fallback-pass"
              ? "&expected_hreflang=2"
              : ["provided-dynamic", "fallback"].includes(scenario)
                ? "&expected_hreflang=80"
                : ""),
          {},
        ),
      });
      const payload = await response.json();
      if (scenario === "unconfigured-failure") {
        expect(response.status).toBe(400);
        expect(payload.error).toContain("503");
        expect(console.error).toHaveBeenCalled();
      } else {
        expect(payload).toMatchObject({
          dryRun: true,
          protocol: 2,
          evaluated: 1,
          hreflangFallbackPages: scenario.startsWith("fallback") ? 1 : 0,
        });
        expect(payload.rows).toHaveLength(1);
        expect(payload.fingerprints.length).toBeGreaterThan(0);
        const hreflang = payload.rows[0].checks.find(
          (check: { name: string }) => check.name === "hreflang",
        );
        expect(hreflang.result).toBe(scenario === "fallback" ? "FAIL" : "PASS");
        if (scenario.startsWith("fallback")) {
          expect(hreflang.detail).toContain(
            scenario === "fallback" ? "2 alternates, 80 expected" : "2 valid alternates",
          );
          expect(hreflang.detail).toContain("Explicit fallback used");
          expect(payload.warnings[0]).toContain("503");
          expect(console.warn).toHaveBeenCalled();
        } else {
          expect(hreflang.detail).toContain("2 valid alternates");
          expect(payload.warnings).toEqual([]);
        }
      }
      expect(mocks.decisions).not.toHaveBeenCalled();
      expect(mocks.prints).not.toHaveBeenCalled();
    },
  );

  it.each(["0", "-1", "1.5", "abc", ""])(
    "rejects invalid fallback %s before reads/writes",
    async (value) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await gatePost({
        request: request(
          `/api/internal/seo-gate?kind=slot&dry_run=1&expected_hreflang=${value}`,
          {},
        ),
      });
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
      expect(mocks.decisions).not.toHaveBeenCalled();
      expect(mocks.prints).not.toHaveBeenCalled();
    },
  );

  it("gate planning delegates only to evaluation-only storage", async () => {
    mocks.saveRun.mockResolvedValue({ saved: false, stopped: false });
    const body = {
      kinds: ["slot"],
      expectedSignature: "a".repeat(32),
      maxDropPercent: 2,
      crossOnly: false,
      decisions: [],
      fingerprints: [],
    };
    const response = await gatePost({
      request: request("/api/internal/seo-gate?phase=plan", body),
    });
    expect(response.status).toBe(200);
    expect(mocks.saveRun).toHaveBeenCalledWith(body, true);
    expect(mocks.decisions).not.toHaveBeenCalled();
    expect(mocks.prints).not.toHaveBeenCalled();
  });
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

  it("allows an owned submitted product to be withdrawn back to draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json([{ id: "p1" }])),
    );
    mocks.rest
      .mockResolvedValueOnce(json([{ id: "p1", moderation_status: "submitted" }]))
      .mockResolvedValueOnce(json([{ id: "p1", moderation_status: "draft" }]));

    const response = await authorPost({
      request: request("/api/author/products", { id: "p1", action: "withdraw" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: "withdraw",
      from: "submitted",
      to: "draft",
    });
    expect(JSON.parse(String(mocks.rest.mock.calls[1][1].body))).toMatchObject({
      moderation_status: "draft",
      content_status: "draft",
    });
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
      expect(mocks.catalogueChanged).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { publish_on_create: true, content_status: "published", moderation_status: "approved" },
    { publish_on_create: false, content_status: "draft", moderation_status: "draft" },
  ])("catalogue creation persists category and publication fields: %s", async (status) => {
    const write = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const row = JSON.parse(String(init.body));
          write(row);
          return json({ id: "p1", ...row });
        }
        return json([]);
      }),
    );
    const client = createClient<Database>("http://db.test", "fixture", {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { retry: false },
    });

    await upsertReviewedProduct(client, {
      name: "Business Suite",
      slug: "business-suite",
      category_id: "10000000-0000-4000-8000-000000000001",
      visible: true,
      content_status: status.content_status,
      moderation_status: status.moderation_status,
    });

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: "10000000-0000-4000-8000-000000000001",
        content_status: status.content_status,
        moderation_status: status.moderation_status,
      }),
    );
    expect(mocks.catalogueChanged).toHaveBeenCalledOnce();
  });

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
    expect(mocks.catalogueChanged).not.toHaveBeenCalled();
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
