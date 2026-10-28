import type { TransactionSql } from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireInternalOperator: vi.fn(),
  withVpsPublicDatabase: vi.fn(),
  auditFails: false,
  statements: [] as string[],
  settings: {
    id: true,
    block_on_malware: true,
    auto_quarantine_flagged: true,
    notify_author_on_rejection: true,
    attach_hash_to_assets: true,
    send_copyright_to_dmca: false,
    result_freshness_days: 30,
    max_upload_mb: 100,
  } as Record<string, unknown>,
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireInternalOperator,
}));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));

import { Route } from "./settings";

type Patch = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { PATCH: Patch } } };
const patchSettings = (Route.options as typeof Route.options & RouteOptions).server.handlers.PATCH;

function transactionMock() {
  let stagedSettings = { ...mocks.settings };
  const taggedQuery = async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    mocks.statements.push(query);
    if (query.includes("select to_jsonb(settings)")) {
      return [{ settings: { ...stagedSettings } }];
    }
    if (query.includes("insert into public.security_events")) {
      if (mocks.auditFails) throw new Error("audit insert failed");
      return [];
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const unsafe = async (query: string, values: unknown[] = []) => {
    mocks.statements.push(query);
    stagedSettings = {
      ...stagedSettings,
      block_on_malware: values[0],
      updated_at: "2026-10-28T00:00:00Z",
    };
    return [
      {
        settings: { ...stagedSettings },
      },
    ];
  };
  const commit = () => {
    mocks.settings = stagedSettings;
  };
  return Object.assign(taggedQuery, { unsafe, commit }) as unknown as TransactionSql & {
    commit: () => void;
  };
}

const request = (body: unknown) =>
  new Request("https://softwarevala.net/api/security/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditFails = false;
  mocks.statements = [];
  mocks.requireInternalOperator.mockResolvedValue({ ok: true, via: "operator:admin" });
  mocks.withVpsPublicDatabase.mockImplementation(
    async (run: (tx: TransactionSql) => Promise<unknown>) => {
      const tx = transactionMock();
      const result = await run(tx);
      tx.commit();
      return result;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanner settings PATCH", () => {
  it("does not report success when the audit insert fails", async () => {
    mocks.auditFails = true;

    const response = await patchSettings({ request: request({ block_on_malware: false }) });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "That setting was not saved" });
    expect(
      mocks.statements.some((sql) => sql.includes("update public.security_scanner_settings")),
    ).toBe(true);
    expect(mocks.statements.some((sql) => sql.includes("insert into public.security_events"))).toBe(
      true,
    );
    expect(mocks.settings.block_on_malware).toBe(true);
  });

  it("returns success only after both the setting update and audit insert complete", async () => {
    const response = await patchSettings({ request: request({ block_on_malware: false }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      settings: { block_on_malware: false },
    });
    expect(
      mocks.statements.some((sql) => sql.includes("update public.security_scanner_settings")),
    ).toBe(true);
    expect(mocks.statements.some((sql) => sql.includes("insert into public.security_events"))).toBe(
      true,
    );
    expect(mocks.settings.block_on_malware).toBe(false);
  });

  it("preserves the operator gate before opening the database transaction", async () => {
    mocks.requireInternalOperator.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Operator sign-in required" }, { status: 401 }),
    });

    const response = await patchSettings({ request: request({ block_on_malware: false }) });

    expect(response.status).toBe(401);
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();
  });

  it("rejects values that do not match the VPS column types", async () => {
    const response = await patchSettings({
      request: request({ block_on_malware: "false" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "block_on_malware must be a boolean" });
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();
  });

  it("enforces the bounds declared by the VPS schema", async () => {
    const response = await patchSettings({
      request: request({ result_freshness_days: 366 }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "result_freshness_days is outside its allowed range",
    });
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();
  });
});
