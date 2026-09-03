import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server layer for the Chat Manager console. Every call is permission-checked. */

type Ctx = { supabase: ReturnType<typeof unknownClient>; userId: string };
function unknownClient() {
  throw new Error("type helper only");
}

async function assertManager(
  supabase: { rpc: (fn: "has_permission", args: { _user_id: string; _permission: string }) => Promise<{ data: unknown }> },
  userId: string,
  permission = "chat.manage",
) {
  const { data } = await supabase.rpc("has_permission", { _user_id: userId, _permission: permission });
  if (data !== true) throw new Error("You do not have permission to manage chat.");
}

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

export const getChatOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatOverview> => {
    const { supabase, userId } = context as unknown as Ctx & typeof context;
    await assertManager(context.supabase as never, context.userId);
    void supabase;
    void userId;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const db = context.supabase;

    const [conversationRows, participantRows, messageRows, handoffRows, auditRows] = await Promise.all([
      db
        .from("conversations")
        .select("id, subject, kind, status, priority, department, ai_enabled, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(80),
      db.from("conversation_participants").select("conversation_id"),
      db.from("messages").select("id, kind, created_at").gte("created_at", since).limit(5000),
      db
        .from("chat_handoffs")
        .select("id, conversation_id, reason, status, created_at, requested_by")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("audit_logs")
        .select("id, action, entity_id, severity, occurred_at, actor")
        .like("action", "chat.%")
        .order("occurred_at", { ascending: false })
        .limit(40),
    ]);

    const conversations = conversationRows.data ?? [];
    const counts = new Map<string, number>();
    for (const row of participantRows.data ?? []) {
      counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
    }
    const messages = messageRows.data ?? [];
    const handoffs = handoffRows.data ?? [];

    const requesterIds = Array.from(new Set(handoffs.map((h) => h.requested_by)));
    const profileMap = new Map<string, string>();
    if (requesterIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", requesterIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p.display_name ?? p.handle ?? p.id);
    }
    const subjectById = new Map(conversations.map((c) => [c.id, c.subject]));

    return {
      kpis: {
        conversations: conversations.length,
        open: conversations.filter((c) => c.status === "open").length,
        escalated: conversations.filter((c) => c.status === "escalated").length,
        messages24h: messages.length,
        aiReplies24h: messages.filter((m) => m.kind === "ai").length,
        pendingHandoffs: handoffs.filter((h) => h.status === "pending").length,
      },
      conversations: conversations.map((c) => ({ ...c, participants: counts.get(c.id) ?? 0 })),
      handoffs: handoffs.map((h) => ({
        ...h,
        subject: subjectById.get(h.conversation_id) ?? "Conversation",
        requester: profileMap.get(h.requested_by) ?? h.requested_by,
      })),
      audit: auditRows.data ?? [],
    };
  });

export const resolveHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { handoffId: string; status: "accepted" | "resolved" | "rejected" }) => {
    if (!input?.handoffId) throw new Error("handoffId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never, context.userId, "chat.assign");
    const patch: Record<string, unknown> = { status: data.status, assigned_to: context.userId };
    if (data.status !== "accepted") patch["resolved_at"] = new Date().toISOString();
    const { error } = await context.supabase.from("chat_handoffs").update(patch).eq("id", data.handoffId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const updateConversationControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; status?: string; priority?: string; aiEnabled?: boolean; department?: string }) => {
      if (!input?.conversationId) throw new Error("conversationId is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.priority) patch["priority"] = data.priority;
    if (typeof data.aiEnabled === "boolean") patch["ai_enabled"] = data.aiEnabled;
    if (data.department !== undefined) patch["department"] = data.department;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("conversations")
      .update(patch)
      .eq("id", data.conversationId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export type RoleMatrix = { roles: string[]; permissions: string[]; granted: Record<string, string[]> };

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleMatrix> => {
    await assertManager(context.supabase as never, context.userId);
    const { data } = await context.supabase.from("role_permissions").select("role, permission");
    const rows = data ?? [];
    const roles = Array.from(new Set(rows.map((r) => r.role as string))).sort();
    const permissions = Array.from(new Set(rows.map((r) => r.permission))).sort();
    const granted: Record<string, string[]> = {};
    for (const row of rows) {
      const key = row.role as string;
      granted[key] = [...(granted[key] ?? []), row.permission];
    }
    return { roles, permissions, granted };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string; permission: string; enabled: boolean }) => {
    if (!input?.role || !input?.permission) throw new Error("role and permission are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("role_permissions")
        .upsert(
          { role: data.role as never, permission: data.permission },
          { onConflict: "role,permission" },
        );
      if (error) return { ok: false as const, error: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("role_permissions")
        .delete()
        .eq("role", data.role as never)
        .eq("permission", data.permission);
      if (error) return { ok: false as const, error: error.message };
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor: context.userId,
      action: "chat.permission.changed",
      entity_type: "role_permission",
      entity_id: null,
      severity: "medium",
      metadata: { role: data.role, permission: data.permission, enabled: data.enabled },
    });
    return { ok: true as const };
  });
