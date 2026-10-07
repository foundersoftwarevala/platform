import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server layer for the Chat Manager console. Every call is permission-checked. */

/** What a Chat Manager action answers: done, or refused with a reason to show. */
export type ChatActionResult = { ok: true } | { ok: false; error: string };

export type ChatOverview = {
  kpis: {
    conversations: number;
    open: number;
    escalated: number;
    messages24h: number;
    aiReplies24h: number;
    pendingHandoffs: number;
  };
  conversations: {
    id: string;
    subject: string;
    kind: string;
    status: string;
    priority: string;
    department: string | null;
    ai_enabled: boolean;
    last_message_at: string;
    participants: number;
  }[];
  handoffs: {
    id: string;
    conversation_id: string;
    subject: string;
    reason: string | null;
    status: string;
    created_at: string;
    requested_by: string;
    requester: string;
  }[];
  audit: {
    id: string;
    action: string;
    entity_id: string | null;
    severity: string;
    occurred_at: string;
    actor: string;
  }[];
};

export type ChatQueueView =
  | "all"
  | "active"
  | "waiting"
  | "pending"
  | "unassigned"
  | "ai"
  | "human"
  | "escalated"
  | "high"
  | "closed"
  | "reopened"
  | "failed"
  | "translation_pending"
  | "translation_failed";

export type ChatQueueFilters = {
  view?: ChatQueueView;
  q?: string;
  status?: "open" | "pending" | "escalated" | "closed" | "resolved";
  priority?: "low" | "normal" | "high" | "urgent";
  handler?: string;
  ai?: "on" | "off";
  from?: string;
  to?: string;
};

export type ChatQueueRow = {
  id: string;
  subject: string;
  kind: string;
  status: string;
  priority: string;
  department: string | null;
  ai_enabled: boolean;
  assigned_agent_id: string | null;
  customer_id: string;
  customer_name: string | null;
  handler_name: string | null;
  last_message_at: string;
  last_body: string | null;
  last_kind: string | null;
  customer_last: boolean;
  participants: number;
  first_customer_at: string | null;
  first_reply_at: string | null;
  agent_key: string | null;
  last_ai_outcome: string | null;
  pending_handoff: boolean;
  translation_failed: boolean;
  tasks: number;
  leads: number;
};

export type ChatAssignableHandler = {
  id: string;
  name: string;
  handle: string | null;
  presence: string;
};

export const getChatManagerAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getChatManagerAccess: readAccess } = await import("@/lib/chat/manager-db.server");
    return readAccess(context.userId);
  });

export const getChatAssignableHandlers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatAssignableHandler[]> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.assign", async (tx) => {
      const handlers = await tx<
        {
          id: string;
          display_name: string | null;
          full_name: string | null;
          handle: string | null;
          presence: string | null;
        }[]
      >`
        select p.id::text, p.display_name, p.full_name, p.handle, p.presence
          from public.profiles p
          join public.user_roles ur on ur.user_id = p.id
          join public.role_permissions rp on rp.role = ur.role
         where rp.permission = 'chat.assign'
         group by p.id
         order by p.display_name nulls last, p.full_name nulls last, p.handle nulls last
      `;
      return handlers.map((profile) => ({
        id: profile.id,
        name: profile.display_name ?? profile.full_name ?? profile.handle ?? profile.id,
        handle: profile.handle,
        presence: profile.presence ?? "unknown",
      }));
    });
  });

export type ChatQueuePage = {
  rows: ChatQueueRow[];
  nextCursor: { at: string; id: string } | null;
};

const CHAT_QUEUE_VIEWS = new Set<ChatQueueView>([
  "all",
  "active",
  "waiting",
  "pending",
  "unassigned",
  "ai",
  "human",
  "escalated",
  "high",
  "closed",
  "reopened",
  "failed",
  "translation_pending",
  "translation_failed",
]);
const CHAT_QUEUE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getChatManagerQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      filters?: ChatQueueFilters;
      limit?: number;
      cursor?: { at: string; id: string } | null;
    }) => {
      const filters = input?.filters ?? {};
      if (filters.view && !CHAT_QUEUE_VIEWS.has(filters.view))
        throw new Error("Unknown Chat Manager queue view.");
      if (
        filters.status &&
        !["open", "pending", "escalated", "closed", "resolved"].includes(filters.status)
      )
        throw new Error("Unknown conversation status.");
      if (filters.priority && !["low", "normal", "high", "urgent"].includes(filters.priority))
        throw new Error("Unknown conversation priority.");
      if (filters.ai && filters.ai !== "on" && filters.ai !== "off")
        throw new Error("Unknown AI filter.");
      if (filters.handler && !CHAT_QUEUE_UUID.test(filters.handler))
        throw new Error("Invalid conversation handler.");
      for (const date of [filters.from, filters.to]) {
        if (date && !Number.isFinite(Date.parse(date))) throw new Error("Invalid queue date.");
      }
      if (input?.cursor && (!CHAT_QUEUE_UUID.test(input.cursor.id) || !input.cursor.at)) {
        throw new Error("Invalid Chat Manager queue cursor.");
      }
      return {
        filters: {
          ...(filters.view ? { view: filters.view } : {}),
          ...(filters.q?.trim() ? { q: filters.q.trim().slice(0, 160) } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.handler ? { handler: filters.handler } : {}),
          ...(filters.ai ? { ai: filters.ai } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        },
        limit: Math.max(1, Math.min(100, Math.floor(input?.limit ?? 30))),
        cursor: input?.cursor ?? null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<ChatQueuePage> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    const result = await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.chat_manager_queue(
          ${JSON.stringify(data.filters)}::jsonb,
          ${data.limit},
          ${data.cursor?.at ?? null}::timestamptz,
          ${data.cursor?.id ?? null}::uuid
        ) as result
      `;
      return row?.result;
    });
    if (
      !result ||
      typeof result !== "object" ||
      !("rows" in result) ||
      !Array.isArray(result.rows)
    ) {
      throw new Error("Chat Manager queue returned an invalid response.");
    }
    const next = "next_cursor" in result ? result.next_cursor : null;
    const nextCursor =
      next &&
      typeof next === "object" &&
      "at" in next &&
      typeof next.at === "string" &&
      "id" in next &&
      typeof next.id === "string"
        ? { at: next.at, id: next.id }
        : null;
    return { rows: result.rows as ChatQueueRow[], nextCursor };
  });

export const getChatOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatOverview> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [kpi] = await tx<
        {
          conversations: number;
          open: number;
          escalated: number;
          messages24h: number;
          aiReplies24h: number;
          pendingHandoffs: number;
        }[]
      >`
        select
          (select count(*)::int from public.conversations) as conversations,
          (select count(*)::int from public.conversations where status = 'open') as open,
          (select count(*)::int from public.conversations where status = 'escalated') as escalated,
          (select count(*)::int from public.messages where created_at >= now() - interval '24 hours') as "messages24h",
          (select count(*)::int from public.messages where kind = 'ai' and created_at >= now() - interval '24 hours') as "aiReplies24h",
          (select count(*)::int from public.chat_handoffs where status = 'pending') as "pendingHandoffs"
      `;
      const conversations = await tx<ChatOverview["conversations"]>`
        select c.id::text, c.subject, c.kind, c.status, c.priority, c.department, c.ai_enabled,
               c.last_message_at::text as last_message_at,
               (select count(*)::int from public.conversation_participants cp where cp.conversation_id = c.id) as participants
          from public.conversations c
         order by c.last_message_at desc
         limit 80
      `;
      const handoffs = await tx<ChatOverview["handoffs"]>`
        select h.id::text, h.conversation_id::text, c.subject, h.reason, h.status, h.created_at::text as created_at,
               h.requested_by::text,
               coalesce(p.display_name, p.handle, h.requested_by::text) as requester
          from public.chat_handoffs h
          join public.conversations c on c.id = h.conversation_id
          left join public.profiles p on p.id = h.requested_by
         order by h.created_at desc
         limit 50
      `;
      const audit = await tx<ChatOverview["audit"]>`
        select id::text, action, entity_id, severity, occurred_at::text as occurred_at, actor
          from public.audit_logs
         where action like 'chat.%'
         order by occurred_at desc
         limit 40
      `;
      return { kpis: kpi!, conversations, handoffs, audit };
    });
  });

export type ChatManagerMonitor = {
  window_hours: number;
  generated_at: string;
  conversations?: {
    total?: number;
    open?: number;
    pending?: number;
    escalated?: number;
    closed?: number;
    ai?: number;
    human?: number;
    unassigned?: number;
    stale_24h?: number;
    high_priority?: number;
  };
  waiting?: { waiting?: number; oldest_waiting_at?: string | null };
  first_response?: {
    samples?: number;
    p50_s?: number | null;
    p95_s?: number | null;
    unanswered?: number;
  };
  ai?: {
    replied?: number;
    escalated?: number;
    failed?: number;
    p50_ms?: number | null;
    p95_ms?: number | null;
    agents?: {
      agent_key: string;
      events: number;
      failed: number;
      avg_ms: number | null;
      last_at: string | null;
    }[];
  };
  providers?: {
    service: string;
    calls: number;
    ok: number;
    failed: number;
    avg_ms: number | null;
    last_at: string | null;
    last_ok_at: string | null;
    last_status: number | null;
  }[];
  agent_runs?: { by_state?: Record<string, number>; last_at?: string | null };
  queue_workers?: {
    job_type: string;
    queued: number;
    running: number;
    completed_window: number;
    failed_window: number;
    dead_letter: number;
    oldest_queued_at: string | null;
    last_activity_at: string | null;
    max_attempts_seen: number;
  }[];
  translation_jobs?: {
    by_status?: Record<string, number>;
    last_activity_at?: string | null;
    oldest_queued_at?: string | null;
  };
  queue_limits?: Record<string, string | number | boolean | null>[];
  chat_translation?: {
    by_status?: Record<string, number>;
    failed?: number;
    pending?: number;
  };
};

export const getChatManagerMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hours?: number } = {}) => {
    const hours = Math.floor(input.hours ?? 24);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      throw new Error("Monitor window must be between 1 and 168 hours.");
    }
    return { hours };
  })
  .handler(async ({ data, context }): Promise<ChatManagerMonitor> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    const result = await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.chat_manager_monitor(${data.hours}) as result
      `;
      return row?.result;
    });
    if (!result || typeof result !== "object" || !("generated_at" in result)) {
      throw new Error("Chat Manager monitor returned an invalid response.");
    }
    return result as ChatManagerMonitor;
  });

export const resolveHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { handoffId: string; status: "accepted" | "resolved" | "rejected" }) => {
    if (!input?.handoffId || !CHAT_QUEUE_UUID.test(input.handoffId)) {
      throw new Error("A valid handoff ID is required.");
    }
    if (!["accepted", "resolved", "rejected"].includes(input.status))
      throw new Error("Unknown handoff status");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.assign", async (tx) => {
      await tx`select public.chat_manager_resolve_handoff(${data.handoffId}::uuid, ${data.status})`;
    });
    return { ok: true } as ChatActionResult;
  });

export const updateConversationControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      conversationId: string;
      status?: "open" | "pending" | "escalated" | "closed" | "resolved";
      priority?: "low" | "normal" | "high" | "urgent";
      aiEnabled?: boolean;
      assignedAgentId?: string | null;
    }) => {
      if (!input?.conversationId || !CHAT_QUEUE_UUID.test(input.conversationId)) {
        throw new Error("A valid conversation ID is required.");
      }
      if (
        input.status !== undefined &&
        !["open", "pending", "escalated", "closed", "resolved"].includes(input.status)
      )
        throw new Error("Unknown conversation status.");
      if (
        input.priority !== undefined &&
        !["low", "normal", "high", "urgent"].includes(input.priority)
      )
        throw new Error("Unknown conversation priority.");
      if (input.assignedAgentId && !CHAT_QUEUE_UUID.test(input.assignedAgentId)) {
        throw new Error("Invalid assignee.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    if (data.assignedAgentId !== undefined) {
      if (data.status || data.priority || typeof data.aiEnabled === "boolean") {
        return {
          ok: false as const,
          error: "Update assignment separately from status, priority, or AI controls.",
        };
      }
      const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
      await withChatManagerIdentity(context.userId, "chat.assign", async (tx) => {
        if (data.assignedAgentId) {
          const [allowed] = await tx<{ allowed: boolean }[]>`
            select public.has_permission(${data.assignedAgentId}::uuid, 'chat.assign') as allowed
          `;
          if (!allowed?.allowed) {
            throw new Error("The selected user cannot handle chat assignments.");
          }
        }
        await tx`select public.chat_manager_set_assignee(
          ${data.conversationId}::uuid, ${data.assignedAgentId ?? null}::uuid
        )`;
      });
      return { ok: true as const };
    }
    if (data.status === undefined && data.priority === undefined && data.aiEnabled === undefined) {
      throw new Error("No conversation change was provided.");
    }
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      await tx`select public.chat_manager_update_conversation(
        ${data.conversationId}::uuid,
        ${data.status ?? null},
        ${data.priority ?? null},
        ${data.aiEnabled ?? null}
      )`;
    });
    return { ok: true as const };
  });

export type ChatManagerParticipant = {
  user_id: string;
  role_label: string | null;
  display_name: string;
  handle: string | null;
  presence: string;
};

export const getChatManagerParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    if (!input?.conversationId || !CHAT_QUEUE_UUID.test(input.conversationId)) {
      throw new Error("A valid conversation ID is required.");
    }
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [conversation] = await tx<{ id: string; subject: string }[]>`
        select id::text, subject from public.conversations where id = ${data.conversationId}::uuid
      `;
      if (!conversation) throw new Error("Conversation not found.");
      const participants = await tx<ChatManagerParticipant[]>`
        select cp.user_id::text, cp.role_label,
               coalesce(p.display_name, p.full_name, p.handle, left(cp.user_id::text, 8)) as display_name,
               p.handle, coalesce(p.presence, 'unknown') as presence
          from public.conversation_participants cp
          left join public.profiles p on p.id = cp.user_id
         where cp.conversation_id = ${data.conversationId}::uuid
         order by display_name
      `;
      return { conversation, participants };
    });
  });

export const updateChatManagerParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; userId: string; action: "add" | "remove" }) => {
    if (
      !input?.conversationId ||
      !CHAT_QUEUE_UUID.test(input.conversationId) ||
      !input.userId ||
      !CHAT_QUEUE_UUID.test(input.userId)
    ) {
      throw new Error("A valid conversation and participant are required.");
    }
    if (input.action !== "add" && input.action !== "remove") {
      throw new Error("Unknown participant action.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.assign", async (tx) => {
      await tx`select public.chat_manager_set_participant(
        ${data.conversationId}::uuid, ${data.userId}::uuid, ${data.action}
      )`;
    });
    return { ok: true } as ChatActionResult;
  });

export type ChatParticipantCandidate = {
  id: string;
  display_name: string;
  handle: string | null;
  presence: string;
};

export const searchChatParticipantCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => {
    const query = input?.query?.trim();
    if (!query || query.length < 2 || query.length > 80) {
      throw new Error("Enter between 2 and 80 characters to search participants.");
    }
    return { query: query.replace(/[%_\\]/g, "\\$&") };
  })
  .handler(async ({ data, context }): Promise<ChatParticipantCandidate[]> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.assign", async (tx) => {
      const needle = `%${data.query}%`;
      return tx<ChatParticipantCandidate[]>`
        select id::text,
               coalesce(display_name, full_name, handle, id::text) as display_name,
               handle, coalesce(presence, 'unknown') as presence
          from public.profiles
         where display_name ilike ${needle}
            or full_name ilike ${needle}
            or handle ilike ${needle}
         order by display_name, full_name, handle
         limit 30
      `;
    });
  });
/** The chat permissions this matrix manages, and the roles that may hold them. */
const CHAT_PERMISSION = /^chat\.[a-z_]+$/;
const CHAT_PERMISSION_ADMIN = "chat.permissions.manage";
const CHAT_STAFF_ROLES = new Set([
  "admin",
  "boss",
  "founder",
  "employee",
  "developer",
  "support",
  "sales",
  "finance",
  "seo",
  "marketing",
]);

export type RoleMatrix = {
  roles: string[];
  permissions: string[];
  granted: Record<string, string[]>;
  canManagePermissions: boolean;
};

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleMatrix> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const rows = await tx<{ role: string; permission: string }[]>`
        select role::text, permission
          from public.role_permissions
         where permission like 'chat.%'
           and permission <> ${CHAT_PERMISSION_ADMIN}
         order by role::text, permission
      `;
      const [access] = await tx<{ can_manage: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, ${CHAT_PERMISSION_ADMIN}) as can_manage
      `;
      const roles = Array.from(new Set(rows.map((row) => row.role)));
      const permissions = Array.from(new Set(rows.map((row) => row.permission)));
      const granted: Record<string, string[]> = {};
      for (const row of rows) granted[row.role] = [...(granted[row.role] ?? []), row.permission];
      return { roles, permissions, granted, canManagePermissions: access?.can_manage === true };
    });
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string; permission: string; enabled: boolean }) => {
    if (!input?.role || !input?.permission) throw new Error("role and permission are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    // This writes role_permissions with the service role, and that table is the
    // permission source for the whole platform (decision.approve, knowledge.*,
    // report.* ...), not only chat. The matrix is the chat matrix: anything
    // outside chat.* is refused, and a chat permission is only granted to a
    // staff role - never to customers, partners or the public.
    if (
      typeof data.permission !== "string" ||
      !CHAT_PERMISSION.test(data.permission) ||
      data.permission === CHAT_PERMISSION_ADMIN
    ) {
      return { ok: false as const, error: "Only chat permissions can be changed here." };
    }
    if (typeof data.role !== "string" || !CHAT_STAFF_ROLES.has(data.role)) {
      return { ok: false as const, error: "Chat permissions can only be granted to staff roles." };
    }
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, CHAT_PERMISSION_ADMIN, async (tx) => {
      await tx`select public.chat_manager_set_role_permission(
        ${data.role}, ${data.permission}, ${data.enabled}
      )`;
    });
    return { ok: true as const };
  });

export type TranscriptMessage = {
  id: string;
  sender_id: string;
  sender: string;
  kind: string;
  body: string;
  created_at: string;
  moderation: { action: string; reason: string; corrected_body: string | null } | null;
  attachments: {
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    media_kind: string;
  }[];
  reactions: { emoji: string; count: number }[];
  receipts: { delivered: number; read: number; total: number };
  translations: {
    target_language: string;
    status: string;
    translated_text: string | null;
    source_language: string | null;
    provider: string | null;
    updated_at: string;
  }[];
};

export type TranscriptCursor = { createdAt: string; id: string };

/** The complete, unmoderated history of one conversation, for Chat Manager review. */
export const getConversationTranscript = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; before?: TranscriptCursor | null; limit?: number }) => {
      if (!input?.conversationId || !CHAT_QUEUE_UUID.test(input.conversationId)) {
        throw new Error("A valid conversation ID is required.");
      }
      if (
        input.before &&
        (!CHAT_QUEUE_UUID.test(input.before.id) ||
          !Number.isFinite(Date.parse(input.before.createdAt)))
      ) {
        throw new Error("Invalid transcript cursor.");
      }
      return {
        conversationId: input.conversationId,
        before: input.before
          ? {
              createdAt: new Date(input.before.createdAt).toISOString(),
              id: input.before.id,
            }
          : null,
        limit: Math.max(1, Math.min(100, Math.floor(input.limit ?? 100))),
      };
    },
  )
  .handler(async ({ data, context }): Promise<TranscriptMessage[]> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const rows = await tx<TranscriptMessage[]>`
        select m.id::text, m.sender_id::text,
               coalesce(p.display_name, p.full_name, p.handle, left(m.sender_id::text, 8)) as sender,
               m.kind, m.body, m.created_at::text as created_at,
               case when mod.message_id is null then null else
                 jsonb_build_object(
                   'action', mod.action, 'reason', mod.reason, 'corrected_body', mod.corrected_body
                 ) end as moderation,
               coalesce((
                 select jsonb_agg(jsonb_build_object(
                   'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type,
                   'size_bytes', a.size_bytes, 'media_kind', a.media_kind
                 ))
                   from public.message_attachments a where a.message_id = m.id
               ), '[]'::jsonb) as attachments,
               coalesce((
                 select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.total) order by r.emoji)
                   from (
                     select emoji, count(*)::int as total
                       from public.message_reactions where message_id = m.id group by emoji
                   ) r
               ), '[]'::jsonb) as reactions,
               jsonb_build_object(
                 'delivered', count(rc.user_id) filter (where rc.user_id <> m.sender_id),
                 'read', count(rc.user_id) filter (where rc.user_id <> m.sender_id and rc.read_at is not null),
                 'total', count(rc.user_id) filter (where rc.user_id <> m.sender_id)
               ) as receipts,
               coalesce((
                 select jsonb_agg(jsonb_build_object(
                   'target_language', t.target_language, 'status', t.status,
                   'translated_text', t.translated_text, 'source_language', t.source_language,
                   'provider', t.provider, 'updated_at', t.updated_at
                 ) order by t.updated_at desc)
                   from public.chat_message_translations t where t.message_id = m.id
               ), '[]'::jsonb) as translations
          from public.messages m
          left join public.profiles p on p.id = m.sender_id
          left join public.chat_message_moderation mod on mod.message_id = m.id
          left join public.message_receipts rc on rc.message_id = m.id
         where m.conversation_id = ${data.conversationId}::uuid
           and (${data.before?.createdAt ?? null}::timestamptz is null
             or (m.created_at, m.id) < (${data.before?.createdAt ?? null}::timestamptz, ${data.before?.id ?? null}::uuid))
         group by m.id, p.display_name, p.full_name, p.handle, mod.message_id, mod.action, mod.reason, mod.corrected_body
         order by m.created_at desc, m.id desc
         limit ${data.limit}
      `;
      return rows.reverse();
    });
  });

export const sendChatManagerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; body: string }) => {
    const body = input?.body?.trim();
    if (!input?.conversationId || !CHAT_QUEUE_UUID.test(input.conversationId)) {
      throw new Error("A valid conversation ID is required.");
    }
    if (!body || body.length > 12_000) {
      throw new Error("A message must contain 1 to 12,000 characters.");
    }
    return { conversationId: input.conversationId, body };
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [canSend] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'message.send') as allowed
      `;
      if (!canSend?.allowed) throw new Error("You do not have permission to send chat messages.");
      await tx`select public.chat_manager_send_message(
        ${data.conversationId}::uuid, ${data.body}
      )`;
    });
    return { ok: true as const };
  });

export const getChatManagerAttachmentUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attachmentId: string }) => {
    if (!input?.attachmentId || !CHAT_QUEUE_UUID.test(input.attachmentId)) {
      throw new Error("A valid attachment ID is required.");
    }
    return { attachmentId: input.attachmentId };
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    const attachment = await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [row] = await tx<{ storage_path: string; file_name: string }[]>`
          select storage_path, file_name
            from public.message_attachments
           where id = ${data.attachmentId}::uuid
        `;
      return row;
    });
    if (!attachment) throw new Error("Attachment not found.");

    // Relative to the Storage API root: the server's own Storage address is a
    // loopback gateway, so the browser prefixes its public one.
    const { signChatDownload } = await import("@/lib/chat/storage.server");
    return { signedPath: await signChatDownload(attachment.storage_path, attachment.file_name) };
  });

/**
 * Chat Manager's remove / correct / restore. The message row itself is never
 * touched: the database records a moderation overlay and an audit entry, and
 * the permission is checked again inside the database function.
 */
export const moderateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      messageId: string;
      action: "hidden" | "corrected" | "restored";
      reason?: string;
      body?: string;
    }) => {
      if (!input?.messageId) throw new Error("messageId is required");
      if (!["hidden", "corrected", "restored"].includes(input.action))
        throw new Error("Unknown action");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.moderate", async (tx) => {
      await tx`select public.chat_moderate_message(
        ${data.messageId}::uuid, ${data.action}, ${data.reason ?? ""}, ${data.body ?? null}
      )`;
    });
    return { ok: true } as ChatActionResult;
  });

export type ChatAgentRow = {
  agent_key: string;
  name: string;
  specialization: string | null;
  permissions: string[];
  channels: string[];
  enabled: boolean;
};
export type ChatAiEvent = {
  id: string;
  conversation_id: string;
  agent_key: string | null;
  domain: string | null;
  language: string | null;
  outcome: string;
  error: string | null;
  lead_id: string | null;
  latency_ms: number | null;
  created_at: string;
};

/** The AI CEO registry as Chat sees it, and what the AI has done in Chat. */
export const getChatAiGovernance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ agents: ChatAgentRow[]; events: ChatAiEvent[] }> => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const agents = await tx<ChatAgentRow[]>`
        select agent_key, name, specialization, permissions, channels,
               ('customer_chat' = any(channels)) as enabled
          from public.ai_agents
         where status = 'active' and agent_key is not null
         order by name
      `;
      const events = await tx<ChatAiEvent[]>`
        select id::text, conversation_id::text, agent_key, domain, language, outcome, error,
               lead_id::text, latency_ms, created_at::text as created_at
          from public.chat_ai_events
         order by created_at desc
         limit 50
      `;
      return { agents, events };
    });
  });

/**
 * Opens an existing AI CEO agent to customers (or closes it). Only the agent's
 * channels list changes; its prompt, permissions and lifecycle stay with the
 * AI CEO module.
 */
export const setAgentChatAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentKey: string; enabled: boolean }) => {
    if (!input?.agentKey) throw new Error("agentKey is required");
    return { agentKey: input.agentKey, enabled: !!input.enabled };
  })
  .handler(async ({ data, context }) => {
    const { withChatManagerIdentity } = await import("@/lib/chat/manager-db.server");
    await withChatManagerIdentity(context.userId, "chat.manage", async (tx) => {
      const [agent] = await tx<{ id: string }[]>`
        update public.ai_agents
           set channels = array_remove(channels, 'customer_chat')
                 || case when ${data.enabled} then array['customer_chat']::text[] else array[]::text[] end
         where agent_key = ${data.agentKey}
        returning id::text
      `;
      if (!agent) throw new Error("That agent is not in the registry.");
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${context.userId}, 'chat.agent.access_changed', 'ai_agent', null, 'medium',
          ${JSON.stringify({ agent_key: data.agentKey, customer_chat: data.enabled })}::jsonb
        )
      `;
    });
    return { ok: true } as ChatActionResult;
  });
