export type MembershipDiscountInput = {
  resellerStatus: string;
  approvedAt: string | null;
  membershipStatus: string;
  startsAt: string | null;
  expiresAt: string | null;
  discountPercent: number;
};

export function activeMembershipDiscount(
  membership: MembershipDiscountInput,
  now = Date.now(),
): number {
  const startsAt = membership.startsAt ? Date.parse(membership.startsAt) : Number.NaN;
  const expiresAt = membership.expiresAt ? Date.parse(membership.expiresAt) : Number.NaN;
  if (
    membership.resellerStatus !== "active" ||
    !membership.approvedAt ||
    membership.membershipStatus !== "active" ||
    !Number.isFinite(startsAt) ||
    startsAt > now ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !Number.isFinite(membership.discountPercent) ||
    membership.discountPercent <= 0
  ) {
    return 0;
  }
  return membership.discountPercent;
}
