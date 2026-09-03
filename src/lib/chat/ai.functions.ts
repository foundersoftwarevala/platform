import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI assistant layer for Connect Chat.
 *
 * The assistant is a real Supabase auth user ("Vala AI") that participates in a
 * conversation, so its replies are ordinary immutable message rows and every
 * client (realtime, receipts, mentions) treats them like any other message.
 */

const BOT_EMAIL = "vala-ai@bot.softwarevala.app";
const BOT_HANDLE = "vala-ai";
const MODEL = "openai/gpt-5.6-sol";
const HANDOFF_MARKER = "[[HANDOFF]]";

const SYSTEM_PROMPT = `You are Vala AI, the assistant inside Software Vala Connect — the company's enterprise chat workspace.
You help staff, vendors, resellers, franchise partners and customers with the Software Vala platform: marketplace, demos, licences, billing, support and the manager consoles.
Rules:
- Reply in the language the user writes in (English, Hindi or Hinglish).
- Be concise: 1-5 short sentences or compact bullets. No markdown headings.
- Never invent revenue, order, ticket or licence data. If you do not have it, say so and point to the right console or offer a human.
- Every Software Vala product is $249 one-time, lifetime.
- If the user asks for a human, is angry, or the request needs an account/billing/legal decision you cannot verify, end your reply with the exact token ${HANDOFF_MARKER} on its own line.`;

type GatewayResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string; retryable: boolean };

async function callGateway(
  apiKey: string,
  input: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<GatewayResult> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, input }),
  });

  if (!res.ok) {
    let message = `AI gateway error (${res.status}).`;
    try {
      const payload = (await res.json()) as { error?: { message?: string }; message?: string };
      message = payload.error?.message ?? payload.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    return {
      ok: false,
      status: res.status,
      error: message,
      retryable: res.status === 429 || res.status >= 500,
    };
  }

  const payload = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  const text =
    payload.output_text?.trim() ||
    (payload.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" || typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("")
      .trim();

  if (!text) return { ok: false, status: 502, error: "AI returned an empty reply.", retryable: true };
  return { ok: true, text };
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function ensureBotUser(admin: AdminClient): Promise<string> {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("handle", BOT_HANDLE)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: BOT_EMAIL,
    password: `${crypto.randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { username: BOT_HANDLE, full_name: "Vala AI", job_title: "AI Assistant" },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Could not provision the AI assistant.");

  await admin
    .from("profiles")
    .update({ handle: BOT_HANDLE, display_name: "Vala AI", job_title: "AI Assistant" })
    .eq("id", created.user.id);
  return created.user.id;
}

/** Generates and persists the assistant's reply for a conversation. */
export const generateAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    if (!input?.conversationId) throw new Error("conversationId is required");
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS: this only returns the row when the caller participates in it.
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, subject, ai_enabled, status, department")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (convError) return { ok: false as const, error: convError.message };
    if (!conversation) return { ok: false as const, error: "Conversation not found." };
    if (!conversation.ai_enabled) return { ok: false as const, error: "AI is disabled for this conversation." };

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("sender_id, body, kind, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(24);
    if (historyError) return { ok: false as const, error: historyError.message };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI is not configured on this workspace." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const botId = await ensureBotUser(supabaseAdmin);

    // The assistant must be a participant before it can appear in the thread.
    await supabaseAdmin
      .from("conversation_participants")
      .upsert(
        { conversation_id: data.conversationId, user_id: botId, role_label: "AI Assistant" },
        { onConflict: "conversation_id,user_id" },
      );

    const turns = (history ?? [])
      .slice()
      .reverse()
      .filter((m) => m.body?.trim())
      .map((m) => ({
        role: (m.sender_id === botId ? "assistant" : "user") as "assistant" | "user",
        content: m.body,
      }));

    const result = await callGateway(apiKey, [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Conversation subject: ${conversation.subject}. Department: ${conversation.department ?? "unassigned"}.`,
      },
      ...turns,
    ]);

    if (!result.ok) {
      await supabaseAdmin.from("audit_logs").insert({
        actor: userId,
        action: "chat.ai.failed",
        entity_type: "conversation",
        entity_id: data.conversationId,
        severity: result.status === 402 || result.status === 403 ? "high" : "medium",
        metadata: { status: result.status, error: result.error, model: MODEL },
      });
      return { ok: false as const, error: result.error, retryable: result.retryable, status: result.status };
    }

    const wantsHuman = result.text.includes(HANDOFF_MARKER);
    const body = result.text.replaceAll(HANDOFF_MARKER, "").trim();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: data.conversationId, sender_id: botId, kind: "ai", body })
      .select("id")
      .single();
    if (insertError) return { ok: false as const, error: insertError.message };

    if (wantsHuman) {
      await supabaseAdmin.from("chat_handoffs").insert({
        conversation_id: data.conversationId,
        requested_by: userId,
        reason: "AI escalated the conversation to a human agent.",
      });
      await supabaseAdmin
        .from("conversations")
        .update({ ai_enabled: false, status: "escalated", priority: "high" })
        .eq("id", data.conversationId);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor: userId,
      action: "chat.ai.reply",
      entity_type: "conversation",
      entity_id: data.conversationId,
      severity: "low",
      metadata: { message_id: inserted.id, model: MODEL, escalated: wantsHuman },
    });

    return { ok: true as const, messageId: inserted.id, escalated: wantsHuman };
  });

/** Turns the AI assistant on or off for a conversation the caller participates in. */
export const setConversationAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; enabled: boolean }) => {
    if (!input?.conversationId) throw new Error("conversationId is required");
    return { conversationId: input.conversationId, enabled: !!input.enabled };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ ai_enabled: data.enabled })
      .eq("id", data.conversationId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, enabled: data.enabled };
  });

/** Explicit "talk to a human" request from a participant. */
export const requestHumanHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; reason?: string }) => {
    if (!input?.conversationId) throw new Error("conversationId is required");
    return { conversationId: input.conversationId, reason: input.reason ?? "" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("chat_handoffs").insert({
      conversation_id: data.conversationId,
      requested_by: userId,
      reason: data.reason || "Participant requested a human agent.",
    });
    if (error) return { ok: false as const, error: error.message };

    await supabase
      .from("conversations")
      .update({ ai_enabled: false, status: "escalated" })
      .eq("id", data.conversationId);
    return { ok: true as const };
  });
