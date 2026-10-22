import { describe, expect, it } from "vitest";
import { activeMembershipDiscount } from "./reseller-membership";

const membership = {
  resellerStatus: "active",
  approvedAt: "2026-01-01T00:00:00.000Z",
  membershipStatus: "active",
  startsAt: "2026-10-01T09:00:00.000Z",
  expiresAt: "2026-10-19T12:00:00.000Z",
  discountPercent: 30,
};

describe("reseller membership discount window", () => {
  it("applies the plan discount from its exact start through just before expiry", () => {
    expect(activeMembershipDiscount(membership, Date.parse("2026-10-01T09:00:00.000Z"))).toBe(30);
    expect(activeMembershipDiscount(membership, Date.parse("2026-10-19T11:59:59.999Z"))).toBe(30);
  });

  it("returns zero at expiry and before the plan starts", () => {
    expect(activeMembershipDiscount(membership, Date.parse("2026-10-19T12:00:00.000Z"))).toBe(0);
    expect(activeMembershipDiscount(membership, Date.parse("2026-10-01T08:59:59.999Z"))).toBe(0);
  });

  it("returns zero when the reseller or membership is not eligible", () => {
    expect(activeMembershipDiscount({ ...membership, resellerStatus: "paused" })).toBe(0);
    expect(activeMembershipDiscount({ ...membership, approvedAt: null })).toBe(0);
    expect(activeMembershipDiscount({ ...membership, membershipStatus: "expired" })).toBe(0);
    expect(activeMembershipDiscount({ ...membership, expiresAt: null })).toBe(0);
  });
});
