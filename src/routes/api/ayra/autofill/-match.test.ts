import type { TransactionSql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsPublicDatabase: vi.fn(),
  autoFillForm: vi.fn(),
  session: { user_id: "10000000-0000-4000-8000-000000000001" } as { user_id: string } | null,
  queryValues: [] as unknown[][],
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));
vi.mock("@/lib/ai-ceo/ayra-autofill.server", () => ({ autoFillForm: mocks.autoFillForm }));

import { Route } from "./match";

type Post = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };
const post = (Route.options as typeof Route.options & RouteOptions).server.handlers.POST;

const fields = [{ index: 0, label: "Company name", name: "company" }];
const token = `ayra_ext_${"a".repeat(43)}`;
const request = (body: unknown, authorization?: string) =>
  new Request("https://softwarevala.net/api/ayra/autofill/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryValues.length = 0;
  mocks.session = { user_id: "10000000-0000-4000-8000-000000000001" };
  mocks.autoFillForm.mockResolvedValue([
    { index: 0, profileFieldName: "company_name", value: "Software Vala" },
  ]);
  mocks.withVpsPublicDatabase.mockImplementation(
    async (run: (tx: TransactionSql) => Promise<unknown>) => {
      const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        mocks.queryValues.push(values);
        if (strings.join(" ").includes("update public.ayra_extension_tokens")) {
          return mocks.session ? [mocks.session] : [];
        }
        return [];
      }) as unknown as TransactionSql;
      return run(tx);
    },
  );
});

describe("AYRA extension autofill API", () => {
  it("authorizes the short-lived token and returns VPS-matched fills without echoing the token", async () => {
    const response = await post({ request: request({ fields }, `Bearer ${token}`) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      fills: [{ index: 0, profileFieldName: "company_name", value: "Software Vala" }],
    });
    expect(mocks.queryValues[0]).not.toContain(token);
    expect(mocks.autoFillForm).toHaveBeenCalledWith(mocks.session?.user_id, fields);
  });

  it("rejects missing and malformed tokens before querying VPS Postgres", async () => {
    const missing = await post({ request: request({ fields }) });
    const malformed = await post({ request: request({ fields }, "Bearer not-a-token") });
    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();
  });

  it("rejects malformed field descriptors and expired or revoked tokens", async () => {
    const invalidBody = await post({
      request: request({ fields: [{ index: 100, label: "Company" }] }, `Bearer ${token}`),
    });
    expect(invalidBody.status).toBe(400);
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();

    mocks.session = null;
    const expired = await post({ request: request({ fields }, `Bearer ${token}`) });
    expect(expired.status).toBe(401);
    expect(mocks.autoFillForm).not.toHaveBeenCalled();
  });
});
