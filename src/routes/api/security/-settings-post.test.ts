import type { TransactionSql } from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireInternalOperator: vi.fn(),
  bearerToken: vi.fn(),
  userFromBearerToken: vi.fn(),
  withVpsPublicDatabase: vi.fn(),
  scanResult: { ok: true, reused: false, job: { id: "job-id" } } as Record<string, unknown>,
  auditFails: false,
  assets: [{ id: "10000000-0000-4000-8000-000000000001" }],
  calls: [] as string[],
  claimValues: [] as unknown[],
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireInternalOperator,
}));
vi.mock("@/lib/auth/bearer-user.server", () => ({
  bearerToken: mocks.bearerToken,
  userFromBearerToken: mocks.userFromBearerToken,
}));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));

import { Route } from "./settings";

type Post = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };
const postSettings = (Route.options as typeof Route.options & RouteOptions).server.handlers.POST;

function transactionMock() {
  const taggedQuery = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    mocks.calls.push(query);
    if (query.includes("set_config('request.jwt.claims'")) {
      mocks.claimValues.push(values[0]);
    }
    if (query.includes("mm_security_scan_start")) {
      return [{ result: { ...mocks.scanResult } }];
    }
    if (query.includes("from public.security_assets")) return mocks.assets;
    if (query.includes("insert into public.security_events")) {
      if (mocks.auditFails) throw new Error("audit insert failed");
      return [];
    }
    return [];
  };
  const unsafe = async () => [];
  return Object.assign(taggedQuery, { unsafe }) as unknown as TransactionSql;
}

const request = (body: unknown) =>
  new Request("https://softwarevala.net/api/security/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-local-token",
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://vps.local");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.auditFails = false;
  mocks.scanResult = { ok: true, reused: false, job: { id: "job-id" } };
  mocks.assets = [{ id: "10000000-0000-4000-8000-000000000001" }];
  mocks.calls = [];
  mocks.claimValues = [];
  mocks.requireInternalOperator.mockResolvedValue({ ok: true, role: "admin" });
  mocks.bearerToken.mockReturnValue("valid-local-token");
  mocks.userFromBearerToken.mockResolvedValue({
    id: "20000000-0000-4000-8000-000000000002",
    email: "operator@example.test",
  });
  mocks.withVpsPublicDatabase.mockImplementation((run: (tx: TransactionSql) => Promise<unknown>) =>
    run(transactionMock()),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(mocks.assets)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("scanner settings POST outcomes", () => {
  it("does not return success when a single scan RPC refuses the request", async () => {
    mocks.scanResult = { ok: false, reason: "not_permitted" };

    const response = await postSettings({ request: request({ assetId: mocks.assets[0]?.id }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining("not_permitted"),
    });
    expect(mocks.calls.some((sql) => sql.includes("mm_security_scan_start"))).toBe(true);
  });

  it("reports failed scans instead of returning full-run success", async () => {
    mocks.scanResult = { ok: false, reason: "not_permitted" };

    const response = await postSettings({ request: request({ full: true }) });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "1 scan failed to start.",
      report: { total: 1, started: 0, reused: 0, failed: 1 },
    });
    expect(mocks.calls.some((sql) => sql.includes("insert into public.security_events"))).toBe(
      true,
    );
  });

  it("reports a failed full-run audit without success-shaped response", async () => {
    mocks.auditFails = true;

    const response = await postSettings({ request: request({ full: true }) });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "The scan run completed, but its audit event could not be recorded.",
    });
  });

  it("runs the scan RPC in the verified operator's database claim context", async () => {
    const response = await postSettings({
      request: request({ assetId: mocks.assets[0]?.id }),
    });

    expect(response.status).toBe(200);
    expect(mocks.calls.some((sql) => sql.includes("set_config('request.jwt.claim.sub'"))).toBe(
      true,
    );
    expect(mocks.calls.some((sql) => sql.includes("mm_security_scan_start"))).toBe(true);
  });

  it("preserves internal-token scan access without inventing a user identity", async () => {
    mocks.requireInternalOperator.mockResolvedValue({ ok: true, via: "internal token" });
    mocks.bearerToken.mockReturnValue(null);
    const internalRequest = request({ assetId: mocks.assets[0]?.id });
    internalRequest.headers.delete("Authorization");
    internalRequest.headers.set("X-Internal-Token", "trusted-internal-token");

    const response = await postSettings({ request: internalRequest });

    expect(response.status).toBe(200);
    expect(mocks.userFromBearerToken).not.toHaveBeenCalled();
    expect(mocks.calls.some((sql) => sql.includes("mm_security_scan_start"))).toBe(true);
    expect(mocks.claimValues).toContain(JSON.stringify({ role: "service_role" }));
    expect(mocks.calls.some((sql) => sql.includes("set_config('request.jwt.claim.sub'"))).toBe(
      false,
    );
  });
});
