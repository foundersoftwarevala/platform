import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serviceRest: vi.fn() }));
vi.mock("./gateway.server", () => ({ serviceRest: mocks.serviceRest }));

import { listApplications } from "./registry.server";

afterEach(() => vi.clearAllMocks());

describe("Reseller Manager application list", () => {
  it("queries only submitted pending/approved applications and returns no decision actions", async () => {
    mocks.serviceRest.mockResolvedValue(
      Response.json([
        {
          id: "pending-id",
          code: "RS-PENDING",
          name: "Pending Applicant",
          email: "pending@example.invalid",
          company_name: "Pending Ltd",
          status: "pending",
          application: { fullName: "Pending Applicant" },
          applied_at: "2026-10-01T00:00:00Z",
          created_at: "2026-10-01T00:00:00Z",
        },
        {
          id: "active-id",
          code: "RS-ACTIVE",
          name: "Approved Applicant",
          email: "active@example.invalid",
          company_name: "Approved Ltd",
          status: "active",
          application: { fullName: "Approved Applicant" },
          applied_at: "2026-10-02T00:00:00Z",
          created_at: "2026-10-02T00:00:00Z",
        },
      ]),
    );

    const rows = await listApplications(["reseller"], true, true);

    expect(mocks.serviceRest).toHaveBeenCalledWith(
      expect.stringContaining("status=in.(pending,active)"),
    );
    expect(mocks.serviceRest).toHaveBeenCalledWith(
      expect.stringContaining("application=not.is.null"),
    );
    expect(rows.map((row) => row.status)).toEqual(["active", "pending"]);
    expect(rows.every((row) => row.actions.length === 0)).toBe(true);
  });

  it("rejects using the restricted Reseller Manager view for another application kind", async () => {
    await expect(listApplications(["vendor"], true, true)).rejects.toThrow(
      "only supports reseller applications",
    );
    expect(mocks.serviceRest).not.toHaveBeenCalled();
  });
});
