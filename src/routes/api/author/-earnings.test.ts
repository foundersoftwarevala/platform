import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sellerId = "10000000-0000-4000-8000-000000000001";

function fixture(failTable?: string) {
  const source = readFileSync(new URL("./earnings.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};

  runInNewContext(output, {
    exports,
    Request,
    Response,
    console,
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
              display_name: "Fixture Author",
              status: "approved",
              payout_currency: "USD",
            },
          }),
          rest: async (path: string) => {
            const table = path.split("?")[0];
            if (table === failTable) return Response.json({}, { status: 503 });
            const rows =
              table === "marketplace_commissions"
                ? [
                    {
                      id: "commission-1",
                      order_item_id: "item-1",
                      gross_amount: 100,
                      commission_amount: 30,
                      seller_amount: 70,
                      payout_id: null,
                      status: "available",
                      created_at: "2026-10-20T00:00:00Z",
                    },
                  ]
                : table === "marketplace_payouts"
                  ? [
                      {
                        id: "payout-1",
                        amount: 20,
                        status: "paid",
                        created_at: "2026-10-21T00:00:00Z",
                      },
                    ]
                  : [{ id: "product-1" }];
            return new Response(JSON.stringify(rows), {
              headers: { "content-range": `0-${rows.length - 1}/${rows.length}` },
            });
          },
        };
      }
      throw new Error(`Unexpected earnings dependency: ${name}`);
    },
  });

  const route = exports.Route as {
    server?: { handlers?: { GET?: (input: { request: Request }) => Promise<Response> } };
  };
  const get = route.server?.handlers?.GET;
  if (!get) throw new Error("Author earnings GET handler missing");
  return get;
}

describe("author earnings data integrity", () => {
  it.each(["marketplace_commissions", "marketplace_payouts", "marketplace_products"])(
    "fails explicitly when %s cannot be read",
    async (table) => {
      const get = fixture(table);
      const response = await get({
        request: new Request("https://fixture.invalid/api/author/earnings"),
      });

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Could not read your earnings" });
    },
  );

  it("calculates totals from commission and payout records", async () => {
    const get = fixture();
    const response = await get({
      request: new Request("https://fixture.invalid/api/author/earnings"),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).totals).toMatchObject({
      products: 1,
      sales: 1,
      gross: 100,
      platformFee: 30,
      earned: 70,
      approved: 70,
      paidOut: 20,
      available: 70,
    });
  });
});
