import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  getRequestHeader: vi.fn(),
}));

vi.mock("@/lib/auth/require-operator.server", () => ({
  requireOperator: mocks.requireOperator,
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mocks.getRequestHeader,
}));

import { requireModuleAnalyticsAccess } from "./analytics-access.server";

describe("module analytics access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestHeader.mockReturnValue("Bearer caller-token");
    mocks.requireOperator.mockResolvedValue({
      userId: "user-1",
      email: "operator@example.test",
      roles: ["admin"],
    });
  });

  it.each([
    ["creator", ["creator_manager"]],
    ["reseller", ["finance", "support", "sales_support_manager"]],
    ["franchise", ["finance", "support", "sales_support_manager"]],
    ["marketplace", ["marketplace_manager"]],
  ] as const)("admits only an operator or a %s manager", async (module, alsoAllow) => {
    await requireModuleAnalyticsAccess(module);

    expect(mocks.requireOperator).toHaveBeenCalledWith(`Reading ${module} analytics`, {
      alsoAllow,
    });
  });

  it("matches the Influencer Manager's admin/boss-only policy", async () => {
    await requireModuleAnalyticsAccess("influencer");

    expect(mocks.requireOperator).toHaveBeenCalledWith("Reading influencer analytics", {
      allowedRoles: ["admin", "boss"],
    });
  });

  it("rejects caller-supplied scope IDs before authorization or data access", async () => {
    await expect(requireModuleAnalyticsAccess("creator", "another-user")).rejects.toThrow(
      /scope is verified/,
    );
    expect(mocks.requireOperator).not.toHaveBeenCalled();
  });

  it("returns an unauthenticated result for server rendering without a bearer session", async () => {
    mocks.getRequestHeader.mockReturnValue(undefined);

    await expect(requireModuleAnalyticsAccess("creator")).resolves.toBe(false);
    expect(mocks.requireOperator).not.toHaveBeenCalled();
  });

  it("propagates authentication and role failures", async () => {
    mocks.requireOperator.mockRejectedValue(new Error("operator rights required"));

    await expect(requireModuleAnalyticsAccess("creator")).rejects.toThrow(
      "operator rights required",
    );
  });
});
