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
    const callerId = await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeliveryOverview } = await import("./dev-manager.server");
    return loadDeliveryOverview(supabaseAdmin, callerId);
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
    return completeDeveloperOnboardingInDb(
      supabaseAdmin,
      reviewerId,
      data.developerId,
      data.note,
      data.actor,
    );
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

const developerInsightInput = z.object({
  kind: z.enum(["skill_match", "delay_prediction"]),
  language: z
    .string()
    .regex(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/)
    .max(35)
    .default("en"),
});

const developerInsightOutput = z.object({
  summary: z.string().trim().min(1).max(800),
  items: z
    .array(
      z.object({
        taskRef: z.string().min(1).max(16),
        developerRef: z.string().min(1).max(16).optional(),
        risk: z.enum(["low", "medium", "high"]).optional(),
        rationale: z.string().trim().min(1).max(400),
        recommendedAction: z.string().trim().max(300).optional(),
        fit: z.enum(["strong", "possible"]).optional(),
      }),
    )
    .max(8),
});

type DeveloperInsightItem = {
  taskId: string;
  taskCode: string;
  developerId?: string;
  developerLabel?: string;
  fit?: "strong" | "possible";
  risk?: "low" | "medium" | "high";
  rationale: string;
  recommendedAction?: string;
};

type DeveloperInsightDTO = {
  kind: "skill_match" | "delay_prediction";
  summary: string;
  items: DeveloperInsightItem[];
  provider: string;
  model: string | null;
  generatedAt: string;
};

function extractInsightJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The configured AI provider did not return a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Generate operator-only, ephemeral recommendations from pseudonymous
 * developer and task data. Personal identifiers and task titles are not sent.
 */
export const generateDeveloperInsight = createServerFn({ method: "POST" })
  .inputValidator((input) => developerInsightInput.parse(input))
  .handler(async ({ data }): Promise<DeveloperInsightDTO> => {
    await requireDevManager();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { executeAiRequest } = await import("@/lib/ai-api.functions");
    const [developerResult, taskResult] = await Promise.all([
      supabaseAdmin
        .from("developers")
        .select("id, vala_id, status, availability_status, max_capacity, skill_tags")
        .in("status", ["active", "probation"])
        .order("created_at", { ascending: true })
        .limit(200),
      supabaseAdmin
        .from("developer_tasks")
        .select("id, status, priority, deadline, tech_stack, estimated_hours, developer_id")
        .not("status", "in", '("completed","delivered","cancelled")')
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (developerResult.error) {
      throw new Error(`Developer data unavailable: ${developerResult.error.message}`);
    }
    if (taskResult.error) {
      throw new Error(`Task data unavailable: ${taskResult.error.message}`);
    }

    const developers = developerResult.data ?? [];
    const tasks = taskResult.data ?? [];
    if (developers.length === 0) {
      throw new Error("AI insights require registered developer data.");
    }
    if (tasks.length === 0) {
      throw new Error("AI insights require open developer task data.");
    }

    const now = Date.now();
    const developerRefs = new Map(
      developers.map((developer, index) => [
        `D${index + 1}`,
        {
          id: developer.id,
          valaId: developer.vala_id ?? `Developer ${index + 1}`,
          skills: developer.skill_tags ?? [],
          availability: developer.availability_status ?? "unknown",
          capacity: developer.max_capacity ?? 0,
          remainingCapacity: Math.max(
            0,
            (developer.max_capacity ?? 0) -
              tasks.filter((task) => task.developer_id === developer.id).length,
          ),
        },
      ]),
    );
    const taskRefs = new Map(
      tasks.map((task, index) => [
        `T${index + 1}`,
        {
          id: task.id,
          code: `TSK-${task.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`,
          status: task.status,
          priority: task.priority,
          techStack: task.tech_stack ?? [],
          estimatedHours: task.estimated_hours ?? null,
          hoursToDeadline: task.deadline
            ? Math.round((new Date(task.deadline).getTime() - now) / 3_600_000)
            : null,
          blockedHours: null,
          developerRef: developers.findIndex((developer) => developer.id === task.developer_id) + 1,
        },
      ]),
    );
    const context = {
      developers: [...developerRefs.entries()].map(([ref, developer]) => ({
        ref,
        skills: developer.skills,
        availability: developer.availability,
        remainingCapacity: developer.remainingCapacity,
      })),
      tasks: [...taskRefs.entries()].map(([ref, task]) => ({
        ref,
        status: task.status,
        priority: task.priority,
        requiredSkills: task.techStack,
        estimatedHours: task.estimatedHours,
        hoursToDeadline: task.hoursToDeadline,
        blockedHours: task.blockedHours,
        assignedDeveloperRef: task.developerRef > 0 ? `D${task.developerRef}` : null,
      })),
    };

    if (
      data.kind === "skill_match" &&
      !context.tasks.some((task) => task.requiredSkills.length > 0)
    ) {
      throw new Error("No open tasks have required technology tags for skill matching.");
    }

    const skillMode = data.kind === "skill_match";
    const system = skillMode
      ? "You are a cautious engineering staffing assistant. Use only the supplied skills and capacity. Do not invent experience. Return JSON only."
      : "You are a cautious delivery-risk assistant. Treat estimates as uncertain; do not claim a precise delivery date or certainty. Return JSON only.";
    const prompt = [
      skillMode
        ? "Suggest up to 8 developer/task matches, only where listed skills support the task and capacity is available."
        : "Assess delivery risk for up to 8 open tasks using status, deadline, blockers, and estimates. Do not infer a delay when there is insufficient evidence.",
      `Write the human-readable summary and explanation in ${data.language}.`,
      "Use only the exact taskRef and developerRef values supplied. Use no real names or external facts.",
      skillMode
        ? 'Return {"summary":"...","items":[{"taskRef":"T1","developerRef":"D1","fit":"strong|possible","rationale":"..."}]}.'
        : 'Return {"summary":"...","items":[{"taskRef":"T1","risk":"low|medium|high","rationale":"...","recommendedAction":"..."}]}.',
      JSON.stringify(context),
    ].join("\n");

    const result = await executeAiRequest({
      module: "developer-manager",
      system,
      prompt,
    });
    const parsed = developerInsightOutput.safeParse(extractInsightJson(result.text));
    if (!parsed.success) {
      throw new Error("The configured AI provider returned an unexpected insight format.");
    }
    const seenTasks = new Set<string>();
    const items: DeveloperInsightItem[] = parsed.data.items.map((item) => {
      const task = taskRefs.get(item.taskRef);
      if (!task || seenTasks.has(item.taskRef)) {
        throw new Error(
          "The configured AI provider returned an unknown or duplicate task reference.",
        );
      }
      seenTasks.add(item.taskRef);
      if (skillMode) {
        const developer = item.developerRef ? developerRefs.get(item.developerRef) : null;
        if (!developer || !item.fit || item.risk) {
          throw new Error(
            "The configured AI provider returned an invalid skill-match recommendation.",
          );
        }
        const hasSkillOverlap = task.techStack.some((requiredSkill) =>
          developer.skills.some(
            (skill) => skill.trim().toLowerCase() === requiredSkill.trim().toLowerCase(),
          ),
        );
        if (!hasSkillOverlap || developer.remainingCapacity < 1) {
          throw new Error(
            "The configured AI provider returned a match without skill overlap or available capacity.",
          );
        }
        return {
          taskId: task.id,
          taskCode: task.code,
          developerId: developer.id,
          developerLabel: developer.valaId,
          fit: item.fit,
          rationale: item.rationale,
        };
      }
      if (!item.risk || item.developerRef || item.fit) {
        throw new Error(
          "The configured AI provider returned an invalid delivery-risk recommendation.",
        );
      }
      return {
        taskId: task.id,
        taskCode: task.code,
        risk: item.risk,
        rationale: item.rationale,
        recommendedAction: item.recommendedAction ?? "",
      };
    });
    return {
      kind: data.kind,
      summary: parsed.data.summary,
      items,
      provider: result.provider,
      model: result.model,
      generatedAt: new Date().toISOString(),
    };
  });
