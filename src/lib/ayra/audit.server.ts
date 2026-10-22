import { withTaskTransaction } from "@/lib/tasks/db.server";

export async function recordAyraInspection(
  actorId: string,
  tool: string,
  input: Record<string, string>,
): Promise<void> {
  await withTaskTransaction(actorId, async (tx) => {
    const roles = await tx<{ role: string }[]>`
      select role::text as role
        from public.user_roles
       where user_id = ${actorId}::uuid
    `;
    if (!roles.some(({ role }) => role === "boss" || role === "admin")) {
      throw new Error("Ayra access requires the boss or admin role.");
    }

    await tx`
      insert into public.audit_logs (
        actor_id, actor, action, entity_type, entity_id, severity, metadata
      ) values (
        ${actorId}::uuid, ${actorId}, 'ayra.inspection', 'ayra',
        ${tool}, 'info', ${JSON.stringify({ tool, input })}::jsonb
      )
    `;
  });
}
