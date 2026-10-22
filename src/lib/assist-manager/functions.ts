import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import type { TaskTransaction } from "@/lib/tasks/db.server";
import type {
  AccessModeRow,
  Agent,
  AiSuggestion,
  Approval,
  AssistSession,
  ChatMessage,
  ControlState,
  EmergencyStop,
  EndUser,
  FileTransfer,
  PrivacyControl,
  SessionRequest,
  SessionWindow,
  SettingRow,
} from "./types";

const OPERATOR_ROLES = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);
const MANAGER_ROLES = new Set([...OPERATOR_ROLES, "support", "sales_support_manager"]);
const ASSIST_ROLES = new Set([...MANAGER_ROLES, "developer", "sales", "employee"]);
const UUID = z.string().uuid();

type AssistActor = {
  id: string;
  email: string | null;
  roles: string[];
  isOperator: boolean;
  isManager: boolean;
  run: <T>(operation: (tx: TaskTransaction) => Promise<T>) => Promise<T>;
};

type SessionDbRow = AssistSession & {
  target_user_id: string | null;
  operator_user_id: string | null;
  end_user_id: string | null;
  agent_id: string | null;
  agent_user_id?: string | null;
  consent_hash: string | null;
  consent_granted: boolean;
  consent_by: string | null;
  consent_revoked_at: string | null;
  control_consent_at: string | null;
  control_consent_by: string | null;
  recording_url: string | null;
  recording_sha256: string | null;
  end_user_user_code?: string | null;
  end_user_role?: string | null;
  end_user_device?: string | null;
  end_user_operating_system?: string | null;
  end_user_active_window?: string | null;
  agent_agent_code?: string | null;
  agent_display_name?: string | null;
  agent_specialisation?: string | null;
  agent_status?: string | null;
};

async function requireAssistActor(
  required: "signed_in" | "assistant" | "manager" | "operator" = "assistant",
): Promise<AssistActor> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");

  const actor: AssistActor = {
    id: caller.id,
    email: caller.email,
    roles: [],
    isOperator: false,
    isManager: false,
    run: async <T>(operation: (tx: TaskTransaction) => Promise<T>) =>
      withTaskTransaction(caller.id, async (tx) => {
        const roleRows = await tx<{ role: string }[]>`
          select role::text as role
            from public.user_roles
           where user_id = ${caller.id}::uuid
        `;
        const roles = roleRows.map((row) => row.role.trim().toLowerCase());
        const isOperator = roles.some((role) => OPERATOR_ROLES.has(role));
        const isManager = roles.some((role) => MANAGER_ROLES.has(role));
        const allowed =
          required === "signed_in"
            ? roles.length > 0
            : required === "operator"
              ? isOperator
              : required === "manager"
                ? isManager
                : roles.some((role) => ASSIST_ROLES.has(role));
        if (!allowed) throw new Error("This account is not authorized for Assist Manager.");
        actor.roles = roles;
        actor.isOperator = isOperator;
        actor.isManager = isManager;
        return operation(tx);
      }),
  };
  return actor;
}

async function getSessionForActor(
  tx: TaskTransaction,
  sessionId: string,
  actorId: string,
  isOperator: boolean,
  lock = false,
): Promise<SessionDbRow> {
  const rows = lock
    ? await tx<SessionDbRow[]>`
        select s.*, e.user_code as end_user_user_code, e.role as end_user_role,
               e.device as end_user_device, e.operating_system as end_user_operating_system,
               e.active_window as end_user_active_window, a.user_id as agent_user_id,
               a.agent_code as agent_agent_code, a.display_name as agent_display_name,
               a.specialisation as agent_specialisation, a.status as agent_status
          from public.assist_sessions s
          left join public.assist_end_users e on e.id = s.end_user_id
          left join public.assist_agents a on a.id = s.agent_id
         where s.id = ${sessionId}::uuid
           and (${isOperator} or s.target_user_id = ${actorId}::uuid
             or s.operator_user_id = ${actorId}::uuid or a.user_id = ${actorId}::uuid)
         for update of s
      `
    : await tx<SessionDbRow[]>`
        select s.*, e.user_code as end_user_user_code, e.role as end_user_role,
               e.device as end_user_device, e.operating_system as end_user_operating_system,
               e.active_window as end_user_active_window, a.user_id as agent_user_id,
               a.agent_code as agent_agent_code, a.display_name as agent_display_name,
               a.specialisation as agent_specialisation, a.status as agent_status
          from public.assist_sessions s
          left join public.assist_end_users e on e.id = s.end_user_id
          left join public.assist_agents a on a.id = s.agent_id
         where s.id = ${sessionId}::uuid
           and (${isOperator} or s.target_user_id = ${actorId}::uuid
             or s.operator_user_id = ${actorId}::uuid or a.user_id = ${actorId}::uuid)
      `;
  const row = rows[0];
  if (!row) throw new Error("Assist session not found or access denied.");
  return hydrateSession(row);
}

async function requireAssignedManager(
  tx: TaskTransaction,
  session: SessionDbRow,
  actorId: string,
): Promise<void> {
  if (session.operator_user_id !== actorId) {
    throw new Error("Only the manager assigned to this Assist session may approve it.");
  }
  const roles = await tx<{ role: string }[]>`
    select role::text as role from public.user_roles where user_id = ${actorId}::uuid
  `;
  if (!roles.some((row) => MANAGER_ROLES.has(row.role.trim().toLowerCase()))) {
    throw new Error("The assigned account no longer has Assist Manager approval rights.");
  }
}

async function logAssistAction(
  tx: TaskTransaction,
  actor: AssistActor,
  session: Pick<SessionDbRow, "id" | "session_code" | "target_user_id" | "end_reason"> | null,
  action: string,
  details: object,
  severity = "info",
): Promise<void> {
  const detailsJson = JSON.stringify(details);
  const role = actor.roles[0] ?? "system";
  await tx`
    insert into public.assist_audit_logs (
      session_id, session_code, actor, actor_user_id, actor_role, action,
      target, target_user_id, new_state, reason, severity, result
    ) values (
      ${session?.id ?? null}::uuid, ${session?.session_code ?? null},
      ${actor.email ?? actor.id}, ${actor.id}::uuid, ${role},
      ${action}, 'session', ${session?.target_user_id ?? null}::uuid,
      ${detailsJson}::jsonb, ${session?.end_reason ?? null}, ${severity}, 'success'
    )
  `;
  if (session) {
    await tx`
      insert into public.assist_logs (session_id, actor_user_id, action, details)
      values (${session.id}::uuid, ${actor.id}::uuid, ${action}, ${detailsJson}::jsonb)
    `;
  }
  await tx`
    insert into public.audit_logs (
      actor_id, actor, action, entity_type, entity_id, severity, after_state, metadata
    ) values (
      ${actor.id}::uuid, ${actor.email ?? actor.id}, ${`assist.${action}`},
      'assist_sessions', ${session?.id ?? null}, ${severity},
      ${detailsJson}::jsonb, ${detailsJson}::jsonb
    )
  `;
}

function sessionResult(row: SessionDbRow): AssistSession {
  return {
    ...row,
    end_user: row.end_user,
    agent: row.agent,
  };
}

export interface CreateAssistInput {
  endUserId: string;
  agentId: string;
  assistType: string;
  accessMode: string;
  purpose: string;
  durationMinutes: number;
  permissions: string[];
  aiAssist: boolean;
}

const createAssistInput = z.object({
  endUserId: UUID,
  agentId: UUID,
  assistType: z.string().trim().min(1).max(60),
  accessMode: z.enum(["view_only", "control_limited", "control_full", "file_transfer", "chat_only"]),
  purpose: z.string().trim().min(5).max(2000),
  durationMinutes: z.number().int().min(1).max(240),
  permissions: z.array(z.enum(["screen_view", "chat", "keyboard", "mouse", "file_transfer"])).max(10),
  aiAssist: z.boolean(),
});

export const fetchSessions = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run(async (tx) => {
    const rows = actor.isManager
      ? await tx<SessionDbRow[]>`
          select s.*, e.user_code as end_user_user_code, e.role as end_user_role,
                 e.device as end_user_device, e.operating_system as end_user_operating_system,
                 e.active_window as end_user_active_window, a.user_id as agent_user_id,
                 a.agent_code as agent_agent_code, a.display_name as agent_display_name,
                 a.specialisation as agent_specialisation, a.status as agent_status
            from public.assist_sessions s
            left join public.assist_end_users e on e.id = s.end_user_id
            left join public.assist_agents a on a.id = s.agent_id
           order by s.created_at desc
        `
      : await tx<SessionDbRow[]>`
          select s.*, e.user_code as end_user_user_code, e.role as end_user_role,
                 e.device as end_user_device, e.operating_system as end_user_operating_system,
                 e.active_window as end_user_active_window, a.user_id as agent_user_id,
                 a.agent_code as agent_agent_code, a.display_name as agent_display_name,
                 a.specialisation as agent_specialisation, a.status as agent_status
            from public.assist_sessions s
            left join public.assist_end_users e on e.id = s.end_user_id
            left join public.assist_agents a on a.id = s.agent_id
           where s.target_user_id = ${actor.id}::uuid
              or s.operator_user_id = ${actor.id}::uuid
              or a.user_id = ${actor.id}::uuid
           order by s.created_at desc
        `;
    return rows.map((row) => sessionResult(hydrateSession(row)));
  });
});

function hydrateSession(row: SessionDbRow): SessionDbRow {
  row.end_user = row.end_user_id
    ? {
        id: row.end_user_id,
        user_code: row.end_user_user_code ?? "",
        role: row.end_user_role ?? "",
        device: row.end_user_device ?? "",
        operating_system: row.end_user_operating_system ?? "",
        active_window: row.end_user_active_window ?? null,
      }
    : null;
  row.agent = row.agent_id
    ? {
        id: row.agent_id,
        agent_code: row.agent_agent_code ?? "",
        display_name: row.agent_display_name ?? "",
        specialisation: row.agent_specialisation ?? "",
        status: (row.agent_status ?? "offline") as Agent["status"],
      }
    : null;
  return row;
}

export const fetchAgents = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor("manager");
  return actor.run((tx) => tx<Agent[]>`
    select id, agent_code, display_name, specialisation, status
      from public.assist_agents
     order by agent_code
  `);
});

export const fetchEndUsers = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor("manager");
  return actor.run((tx) => tx<EndUser[]>`
    select id, user_code, role, device, operating_system, active_window
      from public.assist_end_users
     order by user_code
  `);
});

export const fetchRequests = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<SessionRequest[]>`
    select r.*, jsonb_build_object('id', e.id, 'user_code', e.user_code, 'role', e.role,
             'device', e.device, 'operating_system', e.operating_system,
             'active_window', e.active_window) as end_user
      from public.assist_session_requests r
      left join public.assist_end_users e on e.id = r.end_user_id
     where ${actor.isManager}
        or r.requested_by = ${actor.id}::uuid
        or r.target_user_id = ${actor.id}::uuid
     order by r.created_at desc
  `);
});

export const fetchApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor("manager");
  return actor.run((tx) => tx<Approval[]>`
    select a.*,
           case when s.id is null then null else
             jsonb_build_object('id', s.id, 'session_code', s.session_code) end as session,
           case when ag.id is null then null else
             jsonb_build_object('id', ag.id, 'agent_code', ag.agent_code,
               'display_name', ag.display_name, 'specialisation', ag.specialisation,
               'status', ag.status) end as agent,
           case when e.id is null then null else
             jsonb_build_object('id', e.id, 'user_code', e.user_code, 'role', e.role,
               'device', e.device, 'operating_system', e.operating_system,
               'active_window', e.active_window) end as end_user
      from public.assist_approvals a
      left join public.assist_sessions s on s.id = a.session_id
      left join public.assist_agents ag on ag.id = a.agent_id
      left join public.assist_end_users e on e.id = a.end_user_id
     where ${actor.isManager} or s.operator_user_id = ${actor.id}::uuid
     order by a.submitted_at desc
  `);
});

export const fetchChatMessages = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor();
    return actor.run(async (tx) => {
      await getSessionForActor(tx, data.sessionId, actor.id, actor.isManager);
      return tx<ChatMessage[]>`
        select id, session_id, sender, body, is_translation, created_at
          from public.assist_chat_messages
         where session_id = ${data.sessionId}::uuid order by created_at
      `;
    });
  });

export const fetchTransfers = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<FileTransfer[]>`
    select f.*
      from public.assist_file_transfers f
      join public.assist_sessions s on s.id = f.session_id
      left join public.assist_agents a on a.id = s.agent_id
     where ${actor.isManager} or s.target_user_id = ${actor.id}::uuid
        or s.operator_user_id = ${actor.id}::uuid or a.user_id = ${actor.id}::uuid
     order by f.created_at desc
  `);
});

export const fetchWindows = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor();
    return actor.run(async (tx) => {
      await getSessionForActor(tx, data.sessionId, actor.id, actor.isManager);
      return tx<SessionWindow[]>`
        select id, session_id, title, is_visible, sort_order
          from public.assist_session_windows
         where session_id = ${data.sessionId}::uuid order by sort_order
      `;
    });
  });

export const fetchSuggestions = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<AiSuggestion[]>`
    select sug.*
      from public.assist_ai_suggestions sug
      join public.assist_sessions s on s.id = sug.session_id
      left join public.assist_agents a on a.id = s.agent_id
     where ${actor.isManager} or s.target_user_id = ${actor.id}::uuid
        or s.operator_user_id = ${actor.id}::uuid or a.user_id = ${actor.id}::uuid
     order by sug.created_at desc
  `);
});

export const fetchEmergencyStops = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<EmergencyStop[]>`
    select st.*
      from public.assist_emergency_stops st
     where ${actor.isManager} or exists (
       select 1 from public.assist_sessions s
        left join public.assist_agents a on a.id = s.agent_id
       where s.session_code = st.session_code
         and (s.target_user_id = ${actor.id}::uuid
           or s.operator_user_id = ${actor.id}::uuid
           or a.user_id = ${actor.id}::uuid)
     )
     order by st.created_at desc
  `);
});

export const fetchPrivacyControls = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<PrivacyControl[]>`
    select id, control_key, label, description, icon, enabled, is_critical, sort_order
      from public.assist_privacy_controls order by sort_order
  `);
});

export const fetchAccessModes = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<AccessModeRow[]>`
    select id, mode_key, label, description, icon, is_active, sort_order
      from public.assist_access_modes order by sort_order
  `);
});

export const fetchSettings = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor("manager");
  return actor.run((tx) => tx<SettingRow[]>`
    select id, section, setting_key, label, control_type, value, null::text[] as options,
           sort_order, is_locked
      from public.assist_settings order by section, sort_order
  `);
});

export const fetchControlStates = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor();
  return actor.run((tx) => tx<ControlState[]>`
    select c.*
      from public.assist_control_state c
      join public.assist_sessions s on s.id = c.session_id
      left join public.assist_agents a on a.id = s.agent_id
     where ${actor.isManager} or s.target_user_id = ${actor.id}::uuid
        or s.operator_user_id = ${actor.id}::uuid or a.user_id = ${actor.id}::uuid
  `);
});

export const fetchAssistLogs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID.optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor();
    return actor.run(async (tx) => {
      if (data.sessionId) await getSessionForActor(tx, data.sessionId, actor.id, actor.isManager);
      const eventRows = Array.from(await tx<{
        id: string;
        session_id: string;
        action: string;
        actor_user_id: string | null;
        details: Json;
        created_at: string;
      }[]>`
        select l.id, l.session_id, l.action, l.actor_user_id, l.details,
               l.created_at::text as created_at
          from public.assist_logs l
          join public.assist_sessions s on s.id = l.session_id
          left join public.assist_agents ag on ag.id = s.agent_id
         where (${data.sessionId ?? null}::uuid is null or l.session_id = ${data.sessionId ?? null}::uuid)
           and (${actor.isManager} or s.target_user_id = ${actor.id}::uuid
             or s.operator_user_id = ${actor.id}::uuid or ag.user_id = ${actor.id}::uuid)
         order by l.created_at desc
         limit 500
      `);
      const auditRows = Array.from(await tx<{
        id: string;
        session_id: string | null;
        action: string;
        actor_user_id: string | null;
        old_state: Json | null;
        new_state: Json | null;
        created_at: string;
      }[]>`
        select l.id, l.session_id, l.action, l.actor_user_id, l.old_state, l.new_state,
               l.created_at::text as created_at
          from public.assist_audit_logs l
          left join public.assist_sessions s on s.id = l.session_id
          left join public.assist_agents ag on ag.id = s.agent_id
         where (${data.sessionId ?? null}::uuid is null or l.session_id = ${data.sessionId ?? null}::uuid)
           and (${actor.isManager} or l.actor_user_id = ${actor.id}::uuid
             or l.target_user_id = ${actor.id}::uuid
             or s.target_user_id = ${actor.id}::uuid
             or s.operator_user_id = ${actor.id}::uuid or ag.user_id = ${actor.id}::uuid)
         order by l.created_at desc
         limit 500
      `);
      const platformAuditRows = Array.from(await tx<{
        id: string;
        actor_id: string | null;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        before_state: Json | null;
        after_state: Json | null;
        created_at: string;
      }[]>`
        select l.id, l.actor_id, l.action, l.entity_type, l.entity_id,
               l.before_state, l.after_state, l.created_at::text as created_at
          from public.audit_logs l
          left join public.assist_sessions s on s.id::text = l.entity_id
          left join public.assist_agents ag on ag.id = s.agent_id
         where l.action like 'assist.%'
           and (${data.sessionId ?? null}::uuid is null or l.entity_id = ${data.sessionId ?? null}::text)
           and (${actor.isManager} or l.actor_id = ${actor.id}::uuid
             or s.target_user_id = ${actor.id}::uuid
             or s.operator_user_id = ${actor.id}::uuid or ag.user_id = ${actor.id}::uuid)
         order by l.created_at desc
         limit 500
      `);
      return { events: eventRows, audit: auditRows, platformAudit: platformAuditRows };
    });
  });

export const createAssistSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createAssistInput.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    return actor.run(async (tx) => {
      const endUsers = await tx<{ id: string; user_id: string | null }[]>`
        select id, user_id from public.assist_end_users where id = ${data.endUserId}::uuid
      `;
      const agents = await tx<{ id: string; user_id: string | null }[]>`
        select id, user_id from public.assist_agents where id = ${data.agentId}::uuid
      `;
      const target = endUsers[0];
      const agent = agents[0];
      if (!target?.user_id) throw new Error("The selected target is not linked to a real account.");
      if (!agent?.user_id) throw new Error("The selected assistant is not linked to a real account.");

      const sessionCode = `SVL-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const riskLevel =
        data.accessMode === "control_full" ? "high" : data.accessMode === "control_limited" ? "medium" : "low";
      const rows = await tx<{ id: string; session_code: string }[]>`
        insert into public.assist_sessions (
          session_code, end_user_id, agent_id, assist_type, access_mode, status,
          purpose, ai_involved, permissions, risk_level, target_user_id,
          operator_user_id, created_by
        ) values (
          ${sessionCode}, ${target.id}::uuid, ${agent.id}::uuid, ${data.assistType},
          ${data.accessMode}, 'pending', ${data.purpose}, ${data.aiAssist},
          ${data.permissions.length ? data.permissions : ["screen_view"]},
          ${riskLevel}, ${target.user_id}::uuid, ${actor.id}::uuid, ${actor.id}::uuid
        )
        returning id, session_code
      `;
      const session = rows[0];
      if (!session) throw new Error("The Assist session could not be created.");
      const approvalCode = `APR-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      await tx`
        insert into public.assist_approvals (
          approval_code, session_id, agent_id, end_user_id, assist_type,
          scope, awaiting_role, status, expires_at
        ) values (
          ${approvalCode}, ${session.id}::uuid, ${agent.id}::uuid, ${target.id}::uuid,
          ${data.assistType}, ${data.accessMode}, 'Manager', 'pending',
          now() + (${data.durationMinutes} * interval '1 minute')
        )
      `;
      await tx`
        insert into public.assist_control_state (session_id, control_mode)
        values (${session.id}::uuid, 'view')
      `;
      const sessionRow = await getSessionForActor(tx, session.id, actor.id, true);
      await logAssistAction(tx, actor, sessionRow, "session.created", {
        access_mode: data.accessMode,
        target_user_id: target.user_id,
        agent_user_id: agent.user_id,
      });
      return { id: session.id, session_code: session.session_code };
    });
  });

export const decideRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: UUID, decision: z.enum(["approved", "rejected"]), note: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const requests = await tx<{ id: string; status: string }[]>`
        select id, status from public.assist_session_requests
         where id = ${data.id}::uuid for update
      `;
      if (requests[0]?.status !== "pending") throw new Error("The request is no longer pending.");
      await tx`
        update public.assist_session_requests
           set status = ${data.decision}, review_note = ${data.note ?? null},
               reviewed_at = now(), reviewed_by = ${actor.id}::uuid
         where id = ${data.id}::uuid
      `;
      await tx`
        insert into public.audit_logs (actor_id, actor, action, entity_type, entity_id, metadata)
        values (${actor.id}::uuid, ${actor.email ?? actor.id}, 'assist.request.reviewed',
          'assist_session_requests', ${data.id}, ${JSON.stringify({ status: data.decision, note: data.note ?? null })}::jsonb)
      `;
    });
  });

export const decideApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      id: UUID,
      sessionId: UUID.nullable().optional(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const approvals = await tx<{ id: string; session_id: string | null; status: string; expires_at: string }[]>`
        select id, session_id, status, expires_at
          from public.assist_approvals where id = ${data.id}::uuid for update
      `;
      const approval = approvals[0];
      if (!approval || approval.status !== "pending") throw new Error("The approval is no longer pending.");
      if (!approval.session_id || (data.sessionId && data.sessionId !== approval.session_id)) {
        throw new Error("The approval is not attached to the supplied session.");
      }
      const session = await getSessionForActor(tx, approval.session_id, actor.id, actor.isOperator, true);
      await requireAssignedManager(tx, session, actor.id);
      if (new Date(approval.expires_at).getTime() <= Date.now()) {
        await tx`update public.assist_approvals set status = 'expired', decided_at = now(),
                    decided_by = ${actor.id}::uuid where id = ${data.id}::uuid`;
        await logAssistAction(tx, actor, session, "approval.expired", {
          approval_id: data.id,
        }, "warning");
        return;
      }
      await tx`
        update public.assist_approvals
           set status = ${data.decision}, decided_at = now(),
               decided_by = ${actor.id}::uuid, decision_note = ${data.note ?? null}
         where id = ${data.id}::uuid
      `;
      if (data.decision === "rejected") {
        await tx`
          update public.assist_sessions
             set status = 'blocked', ended_at = now(),
                 end_reason = coalesce(${data.note ?? null}, 'approval refused')
           where id = ${session.id}::uuid and status = 'pending'
        `;
      } else if (session.consent_hash && session.consent_granted) {
        await tx`
          update public.assist_sessions set status = 'active', started_at = coalesce(started_at, now())
           where id = ${session.id}::uuid and status = 'pending'
        `;
      }
      await logAssistAction(tx, actor, session, `approval.${data.decision}`, {
        approval_id: data.id,
        consent_present: Boolean(session.consent_hash),
        note: data.note ?? null,
      });
    });
  });

export const grantConsent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: UUID, consentHash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("signed_in");
    return actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, false, true);
      if (session.target_user_id !== actor.id) throw new Error("Only the target may consent.");
      if (session.status !== "pending" || session.consent_revoked_at) {
        throw new Error("Consent is unavailable for this session.");
      }
      const approvals = await tx<{ id: string }[]>`
        select id from public.assist_approvals
         where session_id = ${session.id}::uuid and status = 'approved'
           and decided_by = ${session.operator_user_id}::uuid
           and expires_at >= now()
         limit 1
      `;
      const started = approvals.length
        ? await tx<{ id: string }[]>`
            update public.assist_sessions
               set consent_granted = true, consent_hash = ${data.consentHash},
                   consent_at = now(), consent_by = ${actor.id}::uuid,
                   consent_revoked_at = null, status = 'active',
                   started_at = coalesce(started_at, now())
             where id = ${session.id}::uuid returning id
          `
        : await tx<{ id: string }[]>`
            update public.assist_sessions
               set consent_granted = true, consent_hash = ${data.consentHash},
                   consent_at = now(), consent_by = ${actor.id}::uuid,
                   consent_revoked_at = null
             where id = ${session.id}::uuid returning id
          `;
      if (!started.length) throw new Error("Consent could not be recorded.");
      await logAssistAction(tx, actor, session, "consent.granted", {
        consent_hash: data.consentHash,
        session_started: approvals.length > 0,
      });
    });
  });

export const denyConsent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID, reason: z.string().trim().min(1).max(1000) }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("signed_in");
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, false, true);
      if (session.target_user_id !== actor.id) throw new Error("Only the target may deny consent.");
      if (session.status !== "pending") throw new Error("This session can no longer be denied.");
      await tx`
        update public.assist_sessions
           set status = 'blocked', ended_at = now(), end_reason = ${data.reason},
               consent_granted = false, consent_revoked_at = now()
         where id = ${session.id}::uuid
      `;
      await logAssistAction(tx, actor, session, "consent.denied", { reason: data.reason }, "warning");
    });
  });

export const endSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: UUID, reason: z.string().trim().min(1).max(1000), emergency: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor();
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.id, actor.id, actor.isOperator, true);
      if (session.status !== "active" && session.status !== "paused" && session.status !== "pending") {
        throw new Error("This Assist session is already closed.");
      }
      const assignedManager = session.operator_user_id === actor.id;
      if (
        (actor.isManager && !actor.isOperator && !assignedManager) ||
        (!actor.isManager && !data.emergency && session.target_user_id !== actor.id)
      ) {
        throw new Error("Only a session participant or manager may end the session.");
      }
      await stopSessionInTransaction(tx, actor, session, data.reason, Boolean(data.emergency));
    });
  });

async function stopSessionInTransaction(
  tx: TaskTransaction,
  actor: AssistActor,
  session: SessionDbRow,
  reason: string,
  emergency: boolean,
  recordEmergencyStop = true,
): Promise<void> {
  const nextStatus = emergency ? "terminated" : "completed";
  await tx`
    update public.assist_sessions
       set status = ${nextStatus}, ended_at = now(), end_reason = ${reason},
           permissions = case when ${emergency} then array[]::text[] else permissions end,
           restrictions = case when ${emergency}
             then array['Emergency stop - all access revoked']::text[] else restrictions end,
           consent_granted = false,
           consent_revoked_at = case when ${emergency} then now() else consent_revoked_at end
     where id = ${session.id}::uuid
  `;
  await tx`
    update public.assist_control_state
       set control_mode = 'freeze', cursor_control = false, keyboard_control = false,
           is_paused = true, voice_active = false, microphone_enabled = false,
           speaker_enabled = false
     where session_id = ${session.id}::uuid
  `;
  await tx`
    update public.assist_file_transfers
       set status = 'failed', deleted_at = now()
     where session_id = ${session.id}::uuid and status in ('pending', 'in_progress')
  `;
  await tx`
    update public.assist_ai_suggestions
       set status = 'dismissed', acted_at = now(), acted_by = ${actor.id}::uuid
     where session_id = ${session.id}::uuid and status = 'open'
  `;
  await tx`update public.assist_session_windows set is_visible = false where session_id = ${session.id}::uuid`;
  await tx`
    update public.assist_approvals
       set status = 'expired', decided_at = now(), decided_by = ${actor.id}::uuid,
           decision_note = coalesce(decision_note, 'session ended')
     where session_id = ${session.id}::uuid and status = 'pending'
  `;
  if (emergency && recordEmergencyStop) {
    await tx`
      insert into public.assist_emergency_stops (
        stop_code, session_code, reason, stopped_by, stopped_by_user_id, stop_type, sessions_affected
      ) values (
        ${`STOP-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`},
        ${session.session_code}, ${reason}, ${actor.email ?? actor.id},
        ${actor.id}::uuid, 'force_single', 1
      )
    `;
  }
  await logAssistAction(tx, actor, session, emergency ? "session.emergency_stopped" : "session.ended", {
    status: nextStatus,
    reason,
  }, emergency ? "critical" : "info");
}

export const stopAllSessions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.string().trim().min(1).max(1000).parse(input))
  .handler(async ({ data: reason }) => {
    const actor = await requireAssistActor("operator");
    return actor.run(async (tx) => {
      const ids = await tx<SessionDbRow[]>`
        select * from public.assist_sessions
         where status in ('active', 'paused', 'pending')
         order by created_at for update
      `;
      for (const row of ids) {
        await stopSessionInTransaction(tx, actor, row, reason, true, false);
      }
      if (ids.length) {
        await tx`
          insert into public.assist_emergency_stops (
            stop_code, session_code, reason, stopped_by, stopped_by_user_id,
            stop_type, sessions_affected
          ) values (
            ${`STOP-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`},
            'ALL', ${reason}, ${actor.email ?? actor.id}, ${actor.id}::uuid,
            'force_all', ${ids.length}
          )
        `;
        await logAssistAction(tx, actor, null, "session.emergency_stopped_all", {
          sessions_affected: ids.length,
          reason,
        }, "critical");
      }
      return ids.length;
    });
  });

export const pauseResumeSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: UUID, pause: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.id, actor.id, actor.isOperator, true);
      await requireAssignedManager(tx, session, actor.id);
      const expected = data.pause ? "active" : "paused";
      const next = data.pause ? "paused" : "active";
      if (session.status !== expected) throw new Error(`Session must be ${expected} to perform this action.`);
      await tx`update public.assist_sessions set status = ${next} where id = ${session.id}::uuid`;
      await tx`
        update public.assist_control_state set is_paused = ${data.pause},
          control_mode = case when ${data.pause} then 'pause' else 'view' end
         where session_id = ${session.id}::uuid
      `;
      await logAssistAction(tx, actor, session, `session.${next}`, { status: next });
    });
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: UUID, body: z.string().trim().min(1).max(4000), sender: z.enum(["agent", "user"]).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor();
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, actor.isManager);
      if (actor.isManager && !actor.isOperator && session.operator_user_id !== actor.id) {
        throw new Error("Only the manager assigned to this session may send Assist chat messages.");
      }
      if (!["active", "paused"].includes(session.status) || !session.consent_hash) {
        throw new Error("Chat is available only in an approved, consented session.");
      }
      const sender = session.target_user_id === actor.id ? "user" : "agent";
      await tx`
        insert into public.assist_chat_messages (session_id, sender, sender_user_id, body)
        values (${session.id}::uuid, ${sender}, ${actor.id}::uuid, ${data.body})
      `;
      await logAssistAction(tx, actor, session, "chat.message_sent", { sender });
    });
  });

export const updateControlState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      sessionId: UUID,
      patch: z.object({
        control_mode: z.enum(["view", "control", "pause", "freeze"]).optional(),
        cursor_control: z.boolean().optional(),
        keyboard_control: z.boolean().optional(),
        window_specific: z.boolean().optional(),
        resolution_lock: z.boolean().optional(),
        is_paused: z.boolean().optional(),
        voice_active: z.boolean().optional(),
        microphone_enabled: z.boolean().optional(),
        speaker_enabled: z.boolean().optional(),
        auto_translate: z.boolean().optional(),
      }).strict().refine((value) => Object.keys(value).length > 0),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, actor.isOperator, true);
      await requireAssignedManager(tx, session, actor.id);
      if (!["active", "paused"].includes(session.status) || !session.consent_hash) {
        throw new Error("Control settings require an active, consented session.");
      }
      if (
        (data.patch.cursor_control || data.patch.keyboard_control || data.patch.control_mode === "control")
        && !session.control_consent_at
      ) {
        throw new Error("The target has not enabled Allow Control.");
      }
      await tx`
        update public.assist_control_state set
          control_mode = coalesce(${data.patch.control_mode ?? null}, control_mode),
          cursor_control = coalesce(${data.patch.cursor_control ?? null}, cursor_control),
          keyboard_control = coalesce(${data.patch.keyboard_control ?? null}, keyboard_control),
          window_specific = coalesce(${data.patch.window_specific ?? null}, window_specific),
          resolution_lock = coalesce(${data.patch.resolution_lock ?? null}, resolution_lock),
          is_paused = coalesce(${data.patch.is_paused ?? null}, is_paused),
          voice_active = coalesce(${data.patch.voice_active ?? null}, voice_active),
          microphone_enabled = coalesce(${data.patch.microphone_enabled ?? null}, microphone_enabled),
          speaker_enabled = coalesce(${data.patch.speaker_enabled ?? null}, speaker_enabled),
          auto_translate = coalesce(${data.patch.auto_translate ?? null}, auto_translate)
         where session_id = ${session.id}::uuid
      `;
      await logAssistAction(tx, actor, session, "control.settings_changed", data.patch);
    });
  });

export const setControlAllowed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID, allowed: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("signed_in");
    return actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, false, true);
      if (session.target_user_id !== actor.id) throw new Error("Only the target may allow remote control.");
      if (!["active", "paused"].includes(session.status) || !session.consent_hash) {
        throw new Error("Allow Control is available only in a consented live session.");
      }
      await tx`
        update public.assist_sessions
           set control_consent_at = case when ${data.allowed} then now() else null end,
               control_consent_by = case when ${data.allowed} then ${actor.id}::uuid else null end
         where id = ${session.id}::uuid
      `;
      if (!data.allowed) {
        await tx`update public.assist_control_state set cursor_control = false,
          keyboard_control = false, control_mode = 'view' where session_id = ${session.id}::uuid`;
      }
      await logAssistAction(tx, actor, session, data.allowed ? "control.allowed" : "control.revoked", {
        allowed: data.allowed,
      });
      return data.allowed;
    });
  });

export const updatePrivacyControl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: UUID, enabled: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("operator");
    await actor.run(async (tx) => {
      const rows = await tx<{ control_key: string; is_critical: boolean }[]>`
        select control_key, is_critical from public.assist_privacy_controls
         where id = ${data.id}::uuid for update
      `;
      if (!rows[0]) throw new Error("Privacy control not found.");
      if (rows[0].is_critical && !data.enabled) throw new Error("Critical privacy controls cannot be disabled.");
      await tx`update public.assist_privacy_controls set enabled = ${data.enabled},
        updated_by = ${actor.id}::uuid where id = ${data.id}::uuid`;
      await logAssistAction(tx, actor, null, "privacy.control_changed", {
        id: data.id, control_key: rows[0].control_key, enabled: data.enabled,
      });
    });
  });

export const updateAccessMode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: UUID, isActive: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("operator");
    await actor.run(async (tx) => {
      const rows = await tx<{ mode_key: string }[]>`
        update public.assist_access_modes set is_active = ${data.isActive},
          updated_by = ${actor.id}::uuid where id = ${data.id}::uuid
        returning mode_key
      `;
      if (!rows[0]) throw new Error("Access mode not found.");
      await logAssistAction(tx, actor, null, "access_mode.changed", {
        id: data.id, mode_key: rows[0].mode_key, active: data.isActive,
      });
    });
  });

export const updateSetting = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: UUID, value: z.string().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("operator");
    await actor.run(async (tx) => {
      const rows = await tx<{ setting_key: string }[]>`
        update public.assist_settings set value = ${data.value}, updated_by = ${actor.id}::uuid
         where id = ${data.id}::uuid and is_locked = false returning setting_key
      `;
      if (!rows[0]) throw new Error("Setting not found or locked.");
      await logAssistAction(tx, actor, null, "setting.changed", {
        id: data.id, setting_key: rows[0].setting_key,
      });
    });
  });

export const updateWindowVisibility = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID, windowId: UUID }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, actor.isOperator, true);
      await requireAssignedManager(tx, session, actor.id);
      const windows = await tx<{ id: string }[]>`
        select id from public.assist_session_windows
         where id = ${data.windowId}::uuid and session_id = ${session.id}::uuid
      `;
      if (!windows.length) throw new Error("The window is not part of this session.");
      await tx`update public.assist_session_windows set is_visible = (id = ${data.windowId}::uuid)
        where session_id = ${session.id}::uuid`;
      await logAssistAction(tx, actor, session, "window.visibility_changed", { window_id: data.windowId });
    });
  });

export const decideSuggestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: UUID, status: z.enum(["accepted", "dismissed"]) }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const rows = await tx<{ session_id: string; status: string }[]>`
        select sug.session_id, sug.status from public.assist_ai_suggestions sug
        join public.assist_sessions s on s.id = sug.session_id
        where sug.id = ${data.id}::uuid
          and (${actor.isOperator} or s.operator_user_id = ${actor.id}::uuid)
        for update of sug
      `;
      if (!rows[0]) throw new Error("Suggestion not found or access denied.");
      if (rows[0].status !== "open") throw new Error("Suggestion has already been resolved.");
      await tx`update public.assist_ai_suggestions
        set status = ${data.status}, acted_by = ${actor.id}::uuid, acted_at = now()
        where id = ${data.id}::uuid`;
      const session = await getSessionForActor(tx, rows[0].session_id, actor.id, actor.isOperator);
      await logAssistAction(tx, actor, session, `suggestion.${data.status}`, { suggestion_id: data.id });
    });
  });

export const createTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      sessionId: UUID,
      fileName: z.string().trim().min(1).max(255),
      sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
      direction: z.enum(["send", "receive"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, actor.isOperator, true);
      await requireAssignedManager(tx, session, actor.id);
      if (!["active", "paused"].includes(session.status) || !session.consent_hash) {
        throw new Error("File transfers require an approved, consented session.");
      }
      if (!session.permissions.includes("file_transfer")) throw new Error("File transfer is not permitted.");
      const transferCode = `FT-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const rows = await tx<{ id: string }[]>`
        insert into public.assist_file_transfers (
          transfer_code, session_id, file_name, size_bytes, direction, status, progress, initiated_by
        ) values (
          ${transferCode}, ${session.id}::uuid, ${data.fileName}, ${data.sizeBytes},
          ${data.direction}, 'pending', 0, ${actor.id}::uuid
        ) returning id
      `;
      await logAssistAction(tx, actor, session, "file_transfer.queued", {
        transfer_id: rows[0]?.id, file_name: data.fileName, size_bytes: data.sizeBytes,
      });
    });
  });

export const updateTransferStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: UUID, status: z.enum(["pending", "in_progress", "completed", "failed"]), progress: z.number().int().min(0).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("manager");
    await actor.run(async (tx) => {
      const rows = await tx<{ session_id: string; status: string }[]>`
        select f.session_id, f.status from public.assist_file_transfers f
        join public.assist_sessions s on s.id = f.session_id
        where f.id = ${data.id}::uuid and (${actor.isOperator} or s.operator_user_id = ${actor.id}::uuid)
        for update of f
      `;
      const transfer = rows[0];
      if (!transfer) throw new Error("Transfer not found or access denied.");
      if (!["pending", "in_progress"].includes(transfer.status)) throw new Error("Transfer is already finalized.");
      if (data.status === "completed" && data.progress !== 100) {
        throw new Error("A completed transfer must report 100 percent progress.");
      }
      await tx`update public.assist_file_transfers set status = ${data.status},
        progress = ${data.progress} where id = ${data.id}::uuid`;
      const session = await getSessionForActor(tx, transfer.session_id, actor.id, actor.isOperator);
      await logAssistAction(tx, actor, session, "file_transfer.updated", {
        transfer_id: data.id, status: data.status, progress: data.progress,
      });
    });
  });

export const getMyPendingConsents = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireAssistActor("signed_in");
  return actor.run((tx) => tx<AssistSession[]>`
    select s.id, s.session_code, s.assist_type, s.access_mode, s.status, s.purpose,
           s.ai_involved, s.permissions, s.restrictions, s.actions_count, s.latency_ms,
           s.resolution, s.frame_rate, s.risk_level, s.started_at, s.ended_at,
           s.end_reason, s.created_at
      from public.assist_sessions s
     where s.target_user_id = ${actor.id}::uuid
       and s.status = 'pending' and s.consent_hash is null
     order by s.created_at desc
     limit 20
  `);
});

export const getAssistSessionTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: UUID }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAssistActor("signed_in");
    return actor.run(async (tx) => {
      const session = await getSessionForActor(tx, data.sessionId, actor.id, false);
      const approvals = await tx<{ valid: boolean }[]>`
        select exists (
          select 1 from public.assist_approvals a
           where a.session_id = ${session.id}::uuid
             and a.status = 'approved'
             and a.decided_by = ${session.operator_user_id}::uuid
             and a.expires_at > now()
        ) as valid
      `;
      if (
        !["active", "paused"].includes(session.status) ||
        !session.consent_hash ||
        !session.consent_granted ||
        session.consent_revoked_at ||
        !approvals[0]?.valid
      ) {
        throw new Error("WebRTC is unavailable until the session is approved and consented.");
      }
      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const { createHash } = await import("node:crypto");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await tx`
        insert into public.assist_signal_tickets (token_hash, session_id, user_id, expires_at)
        values (${tokenHash}, ${session.id}::uuid, ${actor.id}::uuid, now() + interval '45 seconds')
      `;
      await logAssistAction(tx, actor, session, "signaling.ticket_issued", { expires_in_seconds: 45 });
      return { ticket: token, sessionId: session.id };
    });
  });

export type AssistSessionLogs = Awaited<ReturnType<typeof fetchAssistLogs>>;
