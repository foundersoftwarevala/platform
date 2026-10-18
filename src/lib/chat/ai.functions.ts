import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SlidingWindowLimiter } from "@/lib/i18n/limits";
import { agentReply, type Turn } from "@/lib/chat/agent-turn.server";
import { ensureLeadForConversation } from "@/lib/chat/links.server";
import { withChatIdentity, withChatPlatformDatabase } from "@/lib/chat/manager-db.server";

/**
 * Each reply is a metered model call, and any participant could loop this
 * endpoint. Twenty replies a minute per person is far above a conversation.
 */
const replyLimiter = new SlidingWindowLimiter(60_000, 10_000);
const REPLIES_PER_MINUTE = 20;

/**
 * AI replies use the canonical Chat database and the existing AI CEO registry,
 * run functions, and gateway/provider.
 */

const BOT_HANDLE = "vala-ai";
const CHAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AiConversation = {
  id: string;
  subject: string;
  ai_enabled: boolean;
  status: string;
  department: string | null;
  created_by: string;
  can_send: boolean;
};

type AiHistoryMessage = { sender_id: string; body: string; kind: string };

async function getCanonicalBotId(): Promise<string> {
  return withChatPlatformDatabase(async (tx) => {
    const [bot] = await tx<{ id: string }[]>`
      select p.id::text
        from public.profiles p
       where p.handle = ${BOT_HANDLE}
       limit 1
    `;
    if (!bot) {
      throw new Error("The canonical Vala AI account is not provisioned in sv_platform.");
    }
    return bot.id;
  });
}

async function recordAiFailure(
  userId: string,
  conversationId: string,
  startedAt: number,
  reply: Extract<Awaited<ReturnType<typeof agentReply>>, { ok: false }>,
): Promise<void> {
  await withChatPlatformDatabase(async (tx) => {
    await tx`
      insert into public.audit_logs
        (actor, action, entity_type, entity_id, severity, metadata)
      values
        (${userId}, 'chat.ai.failed', 'conversation', ${conversationId},
         ${reply.status === 402 || reply.status === 403 ? "high" : "medium"},
         ${JSON.stringify({
           status: reply.status,
           error: reply.error,
           agent: reply.agentKey,
         })}::text::jsonb)
    `;
    await tx`
      insert into public.chat_ai_events
        (conversation_id, agent_key, agent_run_id, outcome, error, latency_ms)
      values
        (${conversationId}::uuid, ${reply.agentKey}, ${reply.runId}::uuid, 'failed',
         ${reply.error}, ${Date.now() - startedAt})
    `;
  });
}

/** Generates and persists the assistant's reply for a conversation. */
export const generateAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    if (!input || !CHAT_UUID.test(input.conversationId)) {
      throw new Error("A valid conversation identifier is required.");
    }
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (replyLimiter.hit(userId, REPLIES_PER_MINUTE)) {
      return {
        ok: false as const,
        error: "Too many AI replies requested. Please wait a moment.",
        retryable: true,
        status: 429,
      };
    }
    const startedAt = Date.now();

    const conversation = await withChatIdentity(userId, async (tx) => {
      const [row] = await tx<AiConversation[]>`
        select c.id::text, c.subject, c.ai_enabled, c.status, c.department,
               c.created_by::text, public.has_permission(${userId}::uuid, 'message.send') as can_send
          from public.conversations c
         where c.id = ${data.conversationId}::uuid
           and public.is_participant(c.id, ${userId}::uuid)
      `;
      return row ?? null;
    });
    if (!conversation || !conversation.can_send) {
      return { ok: false as const, error: "Conversation not found or you cannot send messages." };
    }
    if (!conversation.ai_enabled)
      return { ok: false as const, error: "AI is disabled for this conversation." };
    if (["closed", "resolved"].includes(conversation.status)) {
      return { ok: false as const, error: "This conversation is closed." };
    }

    const history = await withChatIdentity(
      userId,
      (tx) =>
        tx<AiHistoryMessage[]>`
        select m.sender_id::text,
               coalesce(corrected.corrected_body, m.body) as body, m.kind
          from public.messages m
          left join public.chat_message_moderation corrected
            on corrected.message_id = m.id and corrected.action = 'corrected'
         where m.conversation_id = ${data.conversationId}::uuid
           and not exists (
             select 1 from public.chat_message_moderation hidden
              where hidden.message_id = m.id and hidden.action = 'hidden'
           )
         order by m.created_at desc, m.id desc
         limit 24
      `,
    );
    const botId = await getCanonicalBotId();
    await withChatPlatformDatabase(
      (tx) =>
        tx`
        insert into public.conversation_participants
          (conversation_id, user_id, role_label)
        values (${data.conversationId}::uuid, ${botId}::uuid, 'AI Assistant')
        on conflict (conversation_id, user_id) do nothing
      `,
    );

    const turns: Turn[] = history
      .slice()
      .reverse()
      .filter((m) => m.body?.trim())
      .map((m) => ({
        role: m.sender_id === botId ? ("assistant" as const) : ("user" as const),
        content: m.body,
      }));

    const [previous] = await withChatPlatformDatabase(
      (tx) =>
        tx<{ agent_key: string }[]>`
        select agent_key
          from public.chat_ai_events
         where conversation_id = ${data.conversationId}::uuid and agent_key is not null
         order by created_at desc
         limit 1
      `,
    );

    const reply = await agentReply({
      conversationId: data.conversationId,
      subject: conversation.subject,
      department: conversation.department,
      turns,
      previousAgentKey: previous?.agent_key ?? null,
    });

    if (!reply.ok) {
      await recordAiFailure(userId, data.conversationId, startedAt, reply);
      return {
        ok: false as const,
        error: reply.error,
        retryable: reply.retryable,
        status: reply.status,
      };
    }

    const persisted = await withChatPlatformDatabase(async (tx) => {
      const [locked] = await tx<{ ai_enabled: boolean; status: string }[]>`
        select ai_enabled, status
          from public.conversations
         where id = ${data.conversationId}::uuid
         for update
      `;
      if (!locked || !locked.ai_enabled || ["closed", "resolved"].includes(locked.status)) {
        throw new Error("AI control changed while the reply was being generated; retry the turn.");
      }
      const [inserted] = await tx<{ id: string }[]>`
        insert into public.messages (conversation_id, sender_id, kind, body)
        values (${data.conversationId}::uuid, ${botId}::uuid, 'ai', ${reply.text})
        returning id::text
      `;
      if (!inserted) throw new Error("The AI reply could not be saved.");

      let leadId: string | null = null;
      if (reply.leadReady && reply.agentKey) {
        const lead = await ensureLeadForConversation(tx, {
          conversationId: data.conversationId,
          customerId: conversation.created_by,
          subject: conversation.subject,
          actorId: botId,
          messageId: inserted.id,
          source: "ai_assistant",
        });
        if (lead.ok) {
          leadId = lead.leadId;
        } else {
          await tx`
            insert into public.audit_logs
              (actor, action, entity_type, entity_id, severity, metadata)
            values
              (${botId}::uuid, 'chat.lead.creation_skipped', 'conversation',
               ${data.conversationId}, 'low',
               ${JSON.stringify({ reason: lead.error })}::text::jsonb)
          `;
        }
      }

      if (reply.escalate) {
        const [pendingHandoff] = await tx<{ id: string }[]>`
          select id::text from public.chat_handoffs
           where conversation_id = ${data.conversationId}::uuid and status = 'pending'
           limit 1
        `;
        if (!pendingHandoff) {
          await tx`
            insert into public.chat_handoffs (conversation_id, requested_by, reason)
            values (
              ${data.conversationId}::uuid, ${userId}::uuid,
              'AI escalated the conversation to a human agent.'
            )
          `;
        }
        await tx`
          update public.conversations
             set ai_enabled = false, status = 'escalated', priority = 'high'
           where id = ${data.conversationId}::uuid
        `;
      }

      await tx`
        insert into public.chat_ai_events
          (conversation_id, message_id, agent_key, agent_run_id, domain, language,
           outcome, escalated, lead_id, latency_ms)
        values
          (${data.conversationId}::uuid, ${inserted.id}::uuid, ${reply.agentKey},
           ${reply.runId}::uuid, ${reply.domain}, ${reply.language},
           ${reply.escalate ? "escalated" : "replied"}, ${reply.escalate},
           ${leadId}::uuid, ${Date.now() - startedAt})
      `;
      await tx`
        insert into public.audit_logs
          (actor, action, entity_type, entity_id, severity, metadata)
        values
          (${userId}, 'chat.ai.reply', 'conversation', ${data.conversationId}, 'low',
           ${JSON.stringify({
             message_id: inserted.id,
             agent: reply.agentKey,
             escalated: reply.escalate,
             lead_id: leadId,
           })}::text::jsonb)
      `;
      return { messageId: inserted.id, leadId };
    });

    return { ok: true as const, ...persisted, escalated: reply.escalate };
  });
/** Turns the AI assistant on or off for a conversation the caller participates in. */
export const setConversationAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; enabled: boolean }) => {
    if (!input || !CHAT_UUID.test(input.conversationId)) {
      throw new Error("A valid conversation identifier is required.");
    }
    if (typeof input.enabled !== "boolean") throw new Error("A valid AI setting is required.");
    return { conversationId: input.conversationId, enabled: !!input.enabled };
  })
  .handler(async ({ data, context }) => {
    const { withChatIdentity } = await import("@/lib/chat/manager-db.server");
    return withChatIdentity(context.userId, async (tx) => {
      const [authorization] = await tx<{ allowed: boolean }[]>`
        select (
          public.has_permission(${context.userId}::uuid, 'conversation.manage')
          or public.has_permission(${context.userId}::uuid, 'chat.assign')
          or public.has_permission(${context.userId}::uuid, 'chat.manage')
        ) as allowed
      `;
      if (!authorization?.allowed) {
        return {
          ok: false as const,
          error: "You do not have permission to change AI for this conversation.",
        };
      }
      const updated = await tx`
        update public.conversations
           set ai_enabled = ${data.enabled}
         where id = ${data.conversationId}::uuid
           and (public.is_participant(id, ${context.userId}::uuid)
                or public.has_permission(${context.userId}::uuid, 'chat.manage'))
         returning id
      `;
      if (updated.length === 0) return { ok: false as const, error: "Conversation not found." };
      return { ok: true as const, enabled: data.enabled };
    });
  });

/** Explicit "talk to a human" request from a participant. */
export const requestHumanHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; reason?: string }) => {
    if (!input || !CHAT_UUID.test(input.conversationId)) {
      throw new Error("A valid conversation identifier is required.");
    }
    if (input.reason !== undefined && typeof input.reason !== "string") {
      throw new Error("The handoff reason must be text.");
    }
    return {
      conversationId: input.conversationId,
      reason: (input.reason ?? "").trim().slice(0, 1000),
    };
  })
  .handler(async ({ data, context }) => {
    const { withChatIdentity } = await import("@/lib/chat/manager-db.server");
    try {
      await withChatIdentity(context.userId, async (tx) => {
        const [conversation] = await tx<{ id: string }[]>`
          select id::text
            from public.conversations
           where id = ${data.conversationId}::uuid
             and public.is_participant(id, ${context.userId}::uuid)
           for update
        `;
        if (!conversation) throw new Error("Conversation not found.");
        const [pendingHandoff] = await tx<{ id: string }[]>`
          select id::text
            from public.chat_handoffs
           where conversation_id = ${data.conversationId}::uuid and status = 'pending'
           limit 1
        `;
        if (!pendingHandoff) {
          await tx`
            insert into public.chat_handoffs (conversation_id, requested_by, reason)
            values (
              ${data.conversationId}::uuid, ${context.userId}::uuid,
              ${data.reason || "Participant requested a human agent."}
            )
          `;
        }
        await tx`
          update public.conversations
             set ai_enabled = false,
                 status = 'escalated',
                 priority = case when priority in ('low', 'normal') then 'high' else priority end
           where id = ${data.conversationId}::uuid
        `;
      });
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not request a human handoff.",
      };
    }
  });
