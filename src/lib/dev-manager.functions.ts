/**
 * Developer Manager server functions (typed RPC).
 *
 * Software Vala IS the host platform this module was written to sit inside, so
 * the trust boundary is here. Every handler resolves the caller's bearer token
 * and requires an operator role before touching the admin client, which
 * bypasses row-level security. Every mutation also writes an audit_logs row.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeliveryOverviewDTO, RegistryDeveloperDTO } from "./dev-manager.types";

const actorSchema = z.string().trim().max(120).optional();

/**
 * The caller must be a platform operator before any service-role work happens.
 *
 * These handlers use the admin client, which bypasses row-level security, and
 * the source shipped them with no auth gate at all on the theory that a host
 * application was the trust boundary. Software Vala is that host, so the check
 * belongs here: without it, reading the whole developer registry, suspending a
 * developer or reassigning their work would be open to any caller who could
 * reach the endpoint.
 */
async function requireDevManager(): Promise<string> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Resolved through the shared bearer check: auth.getUser() on a
  // service-role client sends the service key as apikey, which the auth
  // service refuses with "Invalid API key", so this guard used to turn
  // every valid operator away. See lib/auth/bearer-user.server.ts.
  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required");

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);

  const allowed = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);
  if (!(roles ?? []).some((r) => allowed.has(String(r.role)))) {
    throw new Error("Forbidden: Developer Manager role required");
  }
  return caller.id;
}


export const getDeliveryOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DeliveryOverviewDTO> => {
    await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeliveryOverview } = await import("./dev-manager.server");
    return loadDeliveryOverview(supabaseAdmin, null);
  },
);

export const reassignTask = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        newDeveloperId: z.string().uuid(),
        reason: z.string().trim().min(5).max(1000),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reassignTaskInDb } = await import("./dev-manager.server");
    return reassignTaskInDb(
      supabaseAdmin,
      callerId,
      data.taskId,
      data.newDeveloperId,
      data.reason,
      data.actor,
    );
  });

export const escalateTask = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        reason: z.string().trim().min(5).max(1000),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { escalateTaskInDb } = await import("./dev-manager.server");
    return escalateTaskInDb(supabaseAdmin, callerId, data.taskId, data.reason, data.actor);
  });

export const updateEscalation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        escalationId: z.string().uuid(),
        status: z.enum(["acknowledged", "resolved", "rejected"]),
        resolution: z.string().trim().max(1000).nullable().default(null),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { updateEscalationInDb } = await import("./dev-manager.server");
    return updateEscalationInDb(
      supabaseAdmin,
      callerId,
      data.escalationId,
      data.status,
      data.resolution,
      data.actor,
    );
  });

export const addInternalNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        content: z.string().trim().min(3).max(2000),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { addInternalNoteInDb } = await import("./dev-manager.server");
    return addInternalNoteInDb(supabaseAdmin, callerId, data.taskId, data.content, data.actor);
  });

export const getAuditTrail = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(50),
        search: z.string().max(200).default(""),
        module: z.string().max(80).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAuditTrail } = await import("./dev-manager.server");
    return loadAuditTrail(supabaseAdmin, data.page, data.pageSize, data.search, data.module);
  });

export const getDeveloperRegistry = createServerFn({ method: "GET" }).handler(
  async (): Promise<RegistryDeveloperDTO[]> => {
    await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeveloperRegistry } = await import("./dev-manager.server");
    return loadDeveloperRegistry(supabaseAdmin);
  },
);

export const setDeveloperStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        developerId: z.string().uuid(),
        status: z.enum(["active", "suspended", "probation", "exited"]),
        reason: z.string().trim().min(5).max(500),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setDeveloperStatusInDb } = await import("./dev-manager.server");
    return setDeveloperStatusInDb(
      supabaseAdmin,
      data.developerId,
      data.status,
      data.reason,
      data.actor,
      callerId,
    );
  });

export const completeDeveloperOnboarding = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        developerId: z.string().uuid(),
        note: z.string().trim().min(5).max(500),
        actor: actorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const reviewerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { completeDeveloperOnboardingInDb } = await import("./dev-manager.server");
    return completeDeveloperOnboardingInDb(supabaseAdmin, reviewerId, data.developerId, data.note, data.actor);
  });

/**
 * Registry "Escalate": a developer-level escalation recorded in the audit
 * trail by the operator who raised it (the verified caller, not a name the
 * page sends). There is no developer-level escalation table; task
 * escalations are escalateTask.
 */
export const escalateDeveloper = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ developerId: z.string().uuid(), actor: actorSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./dev-manager.server");
    await writeAudit(
      supabaseAdmin,
      callerId,
      "dev_manager.registry",
      "DEVELOPER_ESCALATED",
      { developer_id: data.developerId, severity: "high" },
      data.actor,
    );
    return { ok: true as const };
  });
