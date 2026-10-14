import { requireOperator } from "@/lib/auth/require-operator.server";

const MANAGER_ROLES = new Set(["boss", "boss_owner", "admin", "super_admin", "founder", "owner"]);

export async function requireRdOperator() {
  const operator = await requireOperator("R&D Manager", { alsoAllow: ["owner"] });
  if (!operator.roles.some((role) => MANAGER_ROLES.has(role))) {
    throw new Error("R&D Manager needs a Control Panel manager role.");
  }
  return operator;
}
