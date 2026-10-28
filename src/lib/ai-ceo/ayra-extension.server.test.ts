import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsPublicDatabase: vi.fn(),
  statements: [] as string[],
  values: [] as unknown[][],
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsPublicDatabase,
}));

import { createAyraAutofillExtensionToken } from "./ayra-extension.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.statements.length = 0;
  mocks.values.length = 0;
  mocks.withVpsPublicDatabase.mockImplementation(
    async (run: (tx: TransactionSql) => Promise<unknown>) => {
      const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        mocks.statements.push(strings.join(" "));
        mocks.values.push(values);
        if (strings.join(" ").includes("returning expires_at"))
          return [{ expires_at: "2026-10-29 21:00:00+00" }];
        return [];
      }) as unknown as TransactionSql;
      return run(tx);
    },
  );
});

describe("AYRA extension token issuance", () => {
  it("revokes prior tokens and stores only a hash with a 24-hour expiry", async () => {
    const result = await createAyraAutofillExtensionToken("10000000-0000-4000-8000-000000000001");
    expect(result.token).toMatch(/^ayra_ext_[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt).toBe("2026-10-29 21:00:00+00");
    expect(mocks.statements[0]).toContain("revoked_at = now()");
    expect(mocks.statements[1]).toContain("interval '24 hours'");
    expect(mocks.values[1][0]).toBe(createHash("sha256").update(result.token).digest("hex"));
    expect(mocks.values.flat()).not.toContain(result.token);
  });

  it("rejects invalid executive identifiers before opening a database transaction", async () => {
    await expect(createAyraAutofillExtensionToken("not-a-user-id")).rejects.toThrow(
      "valid executive user",
    );
    expect(mocks.withVpsPublicDatabase).not.toHaveBeenCalled();
  });
});
