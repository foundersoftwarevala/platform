import { requireRdOperator } from "./auth.server";

export async function requireRdUnlocked() {
  await requireRdOperator();
}

export async function getGateSession() {
  const operator = await requireRdOperator();
  return { data: { unlocked: true, admin: true, member: operator.email } };
}
