import { describe, expect, it, vi } from "vitest";
import { resolveResellerCustomerOwnerId } from "./customer-owner.server";

const resellerId = "10000000-0000-4000-8000-000000000001";
const ownerId = "20000000-0000-4000-8000-000000000002";

describe("resolveResellerCustomerOwnerId", () => {
  it("resolves the selected reseller to the team-member owner ID", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(ownerId), { status: 200 }));

    await expect(
      resolveResellerCustomerOwnerId(
        resellerId,
        "https://db.example",
        { apikey: "service" },
        fetcher,
      ),
    ).resolves.toBe(ownerId);
    expect(fetcher).toHaveBeenCalledWith(
      "https://db.example/rest/v1/rpc/reseller_manager_customer_owner_id",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_reseller_id: resellerId }),
      }),
    );
  });

  it("returns null when the selected reseller has no owner mapping", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("null", { status: 200 }));
    await expect(
      resolveResellerCustomerOwnerId(resellerId, "https://db.example", {}, fetcher),
    ).resolves.toBeNull();
  });

  it("surfaces failed lookups and rejects invalid owner IDs", async () => {
    const failedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 500 }));
    await expect(
      resolveResellerCustomerOwnerId(resellerId, "https://db.example", {}, failedFetch),
    ).rejects.toThrow("lookup failed (500)");

    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('"not-a-uuid"', { status: 200 }));
    await expect(
      resolveResellerCustomerOwnerId(resellerId, "https://db.example", {}, malformedFetch),
    ).rejects.toThrow("could not be linked");
  });
});
