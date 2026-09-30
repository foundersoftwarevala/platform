import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { AMS_STATUSES, AMS_PRIORITIES, AMS_CHAT_CHANNELS, requesterMayMove, type AmsStatus, type AmsPriority, type AmsChatChannel } from "./tickets.types";

/**
 * Server fns for the Enterprise AMS ticket module.
 * Auth is handled upstream by Software Vala. Reads degrade gracefully to
 * empty data when no bearer token is present (standalone preview). Writes
 * require a session and throw a clear error otherwise.
 */

function token() {
  const h = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
}
function clientFor(tok?: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined,
    },
  );
}
async function requireUser() {
  const tok = token();
  if (!tok) throw new Error("Sign in required");
  const sb = clientFor(tok);
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sign in required");
  return { sb, uid };
}

/**
 * The people who work tickets. Anyone else who can see a ticket is the person
 * who raised it (or the customer on it), and may only move it along the
 * requester's own path - see REQUESTER_TRANSITIONS.
 */
const AMS_STAFF_ROLES = [
  "developer", "support", "sales_support_manager",
  "admin", "super_admin", "boss", "boss_owner", "founder", "owner",
];

async function isAmsStaff(sb: SupabaseClient<Database>, uid: string): Promise<boolean> {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", uid);
  return (data ?? []).some((r) => AMS_STAFF_ROLES.includes(String(r.role)));
}

// ---------- list ----------
export const listTickets = createServerFn({ method: "GET" })
  .inputValidator((d: { status?: AmsStatus | "all"; priority?: AmsPriority; q?: string; assignee?: "me" | "any"; mine?: boolean }) => d)
  .handler(async ({ data }) => {
    const tok = token();
    if (!tok) return { rows: [], stats: emptyStats() };
    const sb = clientFor(tok);
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;

    let q = sb.from("ams_tickets").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.assignee === "me" && uid) q = q.eq("assignee_id", uid);
    // A partner's own desk: the tickets they raised, even when the viewer is
    // staff who could read every ticket.
    if (data.mine) {
      if (!uid) return { rows: [], stats: emptyStats() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q = (q as any).eq("created_by", uid);
    }
    if (data.q) q = q.or(`subject.ilike.%${data.q}%,ticket_no.ilike.%${data.q}%`);
    const { data: rows } = await q;

    const all = rows ?? [];
    const stats = { ...emptyStats(), total: all.length } as Record<string, number>;
    for (const r of all) stats[r.status] = (stats[r.status] ?? 0) + 1;
    return { rows: all, stats };
  });

function emptyStats() {
  const s: Record<string, number> = { total: 0 };
  for (const k of AMS_STATUSES) s[k] = 0;
  return s;
}

// ---------- get one ----------
export const getTicket = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const tok = token();
    if (!tok) return null;
    const sb = clientFor(tok);
    const [ticket, events, comments, chat, attachments] = await Promise.all([
      sb.from("ams_tickets").select("*").eq("id", data.id).maybeSingle(),
      sb.from("ams_events").select("*").eq("ticket_id", data.id).order("created_at", { ascending: false }).limit(200),
      sb.from("ams_comments").select("*").eq("ticket_id", data.id).order("created_at"),
      sb.from("ams_chat_messages").select("*").eq("ticket_id", data.id).order("created_at"),
      sb.from("ams_attachments").select("*").eq("ticket_id", data.id).order("created_at"),
    ]);
    if (!ticket.data) return null;
    return {
      ticket: ticket.data,
      events: events.data ?? [],
      comments: comments.data ?? [],
      chat: chat.data ?? [],
      attachments: attachments.data ?? [],
    };
  });

// ---------- create ----------
export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((d: {
    subject: string; description?: string; product?: string; category?: string;
    priority?: AmsPriority; department?: string; team?: string;
    expected_resolution_at?: string | null; tags?: string[]; submit?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    if (!data.subject?.trim()) throw new Error("Subject is required");
    const { data: row, error } = await sb.from("ams_tickets").insert({
      subject: data.subject.trim(),
      description: data.description ?? null,
      product: data.product ?? null,
      category: data.category ?? null,
      priority: data.priority ?? "medium",
      status: data.submit ? "submitted" : "draft",
      department: data.department ?? null,
      team: data.team ?? null,
      expected_resolution_at: data.expected_resolution_at ?? null,
      tags: data.tags ?? [],
      created_by: uid,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({ ticket_id: row.id, actor_id: uid, kind: "created", to_value: row.status });
    return row;
  });

// ---------- update ----------
export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Partial<{ subject: string; description: string; priority: AmsPriority; category: string; product: string; department: string; team: string; expected_resolution_at: string | null; tags: string[] }> }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    const { data: row, error } = await sb.from("ams_tickets").update(data.patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({ ticket_id: data.id, actor_id: uid, kind: "updated", payload: data.patch as never });
    return row;
  });

// ---------- status change ----------
export const changeStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; to: AmsStatus }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    if (!AMS_STATUSES.includes(data.to)) throw new Error("Unknown status");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prev } = (await (sb as any).from("ams_tickets").select("status, created_by, assignee_id").eq("id", data.id).single()) as
      { data: { status: string; created_by: string | null; assignee_id: string | null } | null };
    if (!prev) throw new Error("Ticket not found");
    if (!(await isAmsStaff(sb, uid)) && prev.assignee_id !== uid) {
      if (!requesterMayMove(prev.status as AmsStatus, data.to)) {
        throw new Error(`A ticket cannot be moved from ${prev.status} to ${data.to} by the person who raised it.`);
      }
    }
    const patch: Record<string, unknown> = { status: data.to };
    if (data.to === "resolved") patch.resolved_at = new Date().toISOString();
    if (data.to === "closed") patch.closed_at = new Date().toISOString();
    if (data.to === "archived") patch.deleted_at = null;
    const { error } = await sb.from("ams_tickets").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({
      ticket_id: data.id, actor_id: uid, kind: "status_changed",
      from_value: prev?.status ?? null, to_value: data.to,
    });
    return { ok: true };
  });

// ---------- assign ----------
export const assignTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; assignee_id: string | null }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    // Who works a ticket is the support team's decision, not the requester's.
    if (!(await isAmsStaff(sb, uid))) throw new Error("Only the support team can assign a ticket.");
    const { data: prev } = await sb.from("ams_tickets").select("assignee_id, status").eq("id", data.id).single();
    const patch: Record<string, unknown> = { assignee_id: data.assignee_id };
    if (data.assignee_id && prev?.status === "submitted") patch.status = "assigned";
    const { error } = await sb.from("ams_tickets").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({
      ticket_id: data.id, actor_id: uid,
      kind: prev?.assignee_id ? "reassigned" : "assigned",
      from_value: prev?.assignee_id ?? null, to_value: data.assignee_id ?? null,
    });
    return { ok: true };
  });

// ---------- soft delete ----------
export const archiveTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    const { error } = await sb.from("ams_tickets").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({ ticket_id: data.id, actor_id: uid, kind: "archived" });
    return { ok: true };
  });

export const restoreTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    const { error } = await sb.from("ams_tickets").update({ deleted_at: null, status: "submitted" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({ ticket_id: data.id, actor_id: uid, kind: "restored" });
    return { ok: true };
  });

// ---------- comments ----------
export const addComment = createServerFn({ method: "POST" })
  .inputValidator((d: { ticket_id: string; body: string; is_internal?: boolean }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    if (!data.body?.trim()) throw new Error("Empty comment");
    const { data: row, error } = await sb.from("ams_comments").insert({
      ticket_id: data.ticket_id, author_id: uid, body: data.body.trim(), is_internal: !!data.is_internal,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("ams_events").insert({
      ticket_id: data.ticket_id, actor_id: uid,
      kind: data.is_internal ? "internal_note" : "commented",
    });
    return row;
  });

// ---------- chat ----------
export const postChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { ticket_id: string; channel: AmsChatChannel; body: string }) => d)
  .handler(async ({ data }) => {
    const { sb, uid } = await requireUser();
    if (!AMS_CHAT_CHANNELS.includes(data.channel)) throw new Error("Bad channel");
    if (!data.body?.trim()) throw new Error("Empty message");
    const { data: row, error } = await sb.from("ams_chat_messages").insert({
      ticket_id: data.ticket_id, channel: data.channel, author_id: uid, body: data.body.trim(), role: "user",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleChatPin = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; pinned: boolean }) => d)
  .handler(async ({ data }) => {
    const { sb } = await requireUser();
    await sb.from("ams_chat_messages").update({ pinned: data.pinned }).eq("id", data.id);
    return { ok: true };
  });

// Re-export constants so the client can import everything from one path.
export { AMS_STATUSES, AMS_PRIORITIES, AMS_CHAT_CHANNELS };
export type { AmsStatus, AmsPriority, AmsChatChannel };
