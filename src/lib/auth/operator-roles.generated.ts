// Generated from mm_is_operator() in the canonical migration. Do not edit by hand.
export const SQL_OPERATOR_ROLES = [
  "admin",
  "boss",
  "founder",
  "super_admin",
  "boss_owner",
  "marketing",
  "seo",
] as const;

const SQL_OPERATOR_ROLE_SET: ReadonlySet<string> = new Set(SQL_OPERATOR_ROLES);

export function isOperatorRole(role: string): boolean {
  return SQL_OPERATOR_ROLE_SET.has(role);
}
