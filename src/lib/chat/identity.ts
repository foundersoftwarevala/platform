/**
 * Stable business identity for internal chat participants.
 *
 * Internal business communication has to be attributable years later, so every
 * participant needs an identity that is unique, stable and never recycled — and
 * an email address is not that identity. The project had no numeric member-ID
 * system, so this derives one from the single value that is already immutable
 * and never reused: the account's `auth.users.id` UUID.
 *
 * Because the ID is a pure function of that UUID it is assigned once, implicitly,
 * at account creation. Opening chat never mints a new one, nothing is stored that
 * could drift, and a deleted-and-recreated account can never inherit a previous
 * member's number. The role segment reflects the account's highest current role
 * and is shown as its own field, so a promotion changes the label beside the
 * number, never the number itself.
 */

/** Highest authority first — a user holding several roles is identified by the strongest. */
const ROLE_RANK: readonly string[] = [
  "founder",
  "boss",
  "admin",
  "developer",
  "dev-manager",
  "finance",
  "support",
  "sales",
  "marketing",
  "seo",
  "employee",
  "franchise",
  "reseller",
  "vendor",
  "author",
  "influencer",
  "affiliate",
  "customer",
  "marketplace-user",
];

const ROLE_PREFIX: Record<string, string> = {
  founder: "FDR",
  boss: "BOS",
  admin: "ADM",
  developer: "DEV",
  "dev-manager": "DVM",
  finance: "FIN",
  support: "SUP",
  sales: "SAL",
  marketing: "MKT",
  seo: "SEO",
  employee: "EMP",
  franchise: "FRN",
  reseller: "RES",
  vendor: "VEN",
  author: "AUT",
  influencer: "INF",
  affiliate: "AFF",
  customer: "CUS",
  "marketplace-user": "MPU",
};

const ROLE_LABEL: Record<string, string> = {
  founder: "Founder",
  boss: "Boss",
  admin: "Admin",
  developer: "Developer",
  "dev-manager": "Developer Management",
  finance: "Finance",
  support: "Support",
  sales: "Sales",
  marketing: "Marketing",
  seo: "SEO",
  employee: "Employee",
  franchise: "Franchise",
  reseller: "Reseller",
  vendor: "Vendor",
  author: "Author",
  influencer: "Influencer",
  affiliate: "Affiliate",
  customer: "Customer",
  "marketplace-user": "Marketplace User",
};

/** The strongest role a user holds, or `null` when they hold none. */
export function primaryRole(roles: readonly string[] | null | undefined): string | null {
  if (!roles || roles.length === 0) return null;
  for (const candidate of ROLE_RANK) {
    if (roles.includes(candidate)) return candidate;
  }
  return roles[0] ?? null;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Member";
  return ROLE_LABEL[role] ?? role.replace(/(^|[-_])(\w)/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());
}

/**
 * Eight stable digits derived from the account UUID. FNV-1a over the whole UUID,
 * so two different accounts practically never collide and the same account always
 * produces the same number on every device and every render.
 */
function stableNumber(userId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // 10,000,000–99,999,999 so the number is always eight digits and never starts with 0.
  return String(10000000 + (Math.abs(hash) % 90000000));
}

/**
 * The identity shown next to a participant: `SV-RES-40921883`.
 * The trailing number is immutable for the life of the account.
 */
export function memberId(userId: string, roles: readonly string[] | null | undefined): string {
  if (!userId) return "SV-UNKNOWN";
  const role = primaryRole(roles);
  const prefix = role ? (ROLE_PREFIX[role] ?? "MEM") : "MEM";
  return `SV-${prefix}-${stableNumber(userId)}`;
}

/** The immutable number on its own, for surfaces that show the role separately. */
export function memberNumber(userId: string): string {
  return userId ? stableNumber(userId) : "—";
}
