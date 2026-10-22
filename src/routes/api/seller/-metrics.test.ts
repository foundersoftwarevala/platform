import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const sellerId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const orderId = "30000000-0000-4000-8000-000000000001";
const versionId = "40000000-0000-4000-8000-000000000001";

function fixture(failTable?: string) {
  const requested: string[] = [];
  const source = readFileSync(new URL("./metrics.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};

  const rowsFor = (table: string): Record<string, unknown>[] => {
    if (table === "marketplace_products") {
      return [
        {
          id: productId,
          moderation_status: "approved",
          content_status: "published",
          visible: true,
          publish_at: null,
          unpublish_at: null,
          downloads: 9000,
        },
        {
          id: "20000000-0000-4000-8000-000000000002",
          moderation_status: "approved",
          content_status: "draft",
          visible: true,
          publish_at: null,
          unpublish_at: null,
          downloads: 5000,
        },
      ];
    }
    if (table === "marketplace_order_items") {
      return [
        { id: "item-1", order_id: orderId, line_total: 99, created_at: "2026-10-20T00:00:00Z" },
      ];
    }
    if (table === "marketplace_product_versions") return [{ id: versionId }];
    if (table === "marketplace_downloads") return [{ id: "download-1" }, { id: "download-2" }];
    if (table === "marketplace_orders") {
      return [
        { id: orderId, status: "paid", buyer_id: "buyer-1", created_at: "2026-10-20T00:00:00Z" },
      ];
    }
    if (table === "marketplace_commissions") {
      return [
        {
          id: "commission-1",
          order_item_id: "item-1",
          gross_amount: 99,
          seller_amount: 80,
          status: "approved",
          created_at: "2026-10-20T00:00:00Z",
        },
      ];
    }
    throw new Error(`Unexpected fixture relation: ${table}`);
  };

  runInNewContext(output, {
    exports,
    console: { error: vi.fn() },
    Request,
    Response,
    require: (name: string) => {
      if (name === "@tanstack/react-router") {
        return { createFileRoute: () => (options: unknown) => options };
      }
      if (name === "@/lib/marketplace/author-guard") {
        return {
          requireAuthor: async () => ({
            ok: true,
            seller: {
              id: sellerId,
              display_name: "Fixture Seller",
              status: "approved",
              payout_currency: "USD",
            },
          }),
          rest: async (path: string) => {
            const table = path.split("?")[0];
            requested.push(table);
            if (table === failTable) return Response.json({}, { status: 503 });
            const rows = rowsFor(table);
            return Response.json(rows, {
              headers: { "content-range": `0-${rows.length - 1}/${rows.length}` },
            });
          },
        };
      }
      throw new Error(`Unexpected metrics dependency: ${name}`);
    },
  });

  const route = exports.Route as {
    server?: { handlers?: { GET?: (input: { request: Request }) => Promise<Response> } };
  };
  const get = route.server?.handlers?.GET;
  if (!get) throw new Error("Metrics GET handler missing");
  return { get, requested };
}

describe("seller metrics data integrity", () => {
  it.each([
    "marketplace_products",
    "marketplace_order_items",
    "marketplace_commissions",
    "marketplace_product_versions",
    "marketplace_downloads",
    "marketplace_orders",
  ])("fails explicitly when %s cannot be read", async (table) => {
    const f = fixture(table);
    const response = await f.get({
      request: new Request("https://fixture.invalid/api/seller/metrics"),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Could not load your dashboard figures" });
  });

  it("uses published products and recorded downloads, not stored download counters", async () => {
    const f = fixture();
    const response = await f.get({
      request: new Request("https://fixture.invalid/api/seller/metrics"),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).metrics).toMatchObject({
      products: 1,
      downloads: 2,
      sales: 1,
    });
    expect(f.requested).toContain("marketplace_downloads");
  });
});
