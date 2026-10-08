import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { openTask } from "@/lib/tm/task-service.functions";
import { ensureLeadForConversation, validateConversationMessage } from "@/lib/chat/links.server";
import { withChatIdentity, type ChatManagerTransaction } from "@/lib/chat/manager-db.server";

type Conversation = { id: string; subject: string; created_by: string };
type ConversationLink = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  entity_type: "task" | "lead";
  entity_id: string;
  source: string;
  created_by: string | null;
  created_at: string;
};

const NOT_ALLOWED = { ok: false as const, error: "You cannot handle this conversation." };
const linkInput = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
});

async function findHandledConversation(
  tx: ChatManagerTransaction,
  userId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const [conversation] = await tx<Conversation[]>`
    select c.id::text, c.subject, c.created_by::text
      from public.conversations c
     where c.id = ${conversationId}::uuid
       and (
         public.has_permission(${userId}::uuid, 'chat.manage')
         or (
           public.has_permission(${userId}::uuid, 'conversation.manage')
           and public.is_participant(c.id, ${userId}::uuid)
         )
       )
  `;
  return conversation ?? null;
}

async function handledConversation(
  userId: string,
  conversationId: string,
  messageId: string | null,
) {
  return withChatIdentity(userId, async (tx) => {
    const conversation = await findHandledConversation(tx, userId, conversationId);
    if (conversation) await validateConversationMessage(tx, conversationId, messageId);
    return conversation;
  });
}

async function recordLink(
  tx: ChatManagerTransaction,
  input: {
    conversationId: string;
    messageId: string | null;
    entityType: "task" | "lead";
    entityId: string;
    actorId: string;
    source: "chat_manager";
  },
) {
  await validateConversationMessage(tx, input.conversationId, input.messageId);

  await tx`
    insert into public.chat_conversation_links
      (conversation_id, message_id, entity_type, entity_id, source, created_by)
    values
      (${input.conversationId}::uuid, ${input.messageId}::uuid, ${input.entityType},
       ${input.entityId}::uuid, ${input.source}, ${input.actorId}::uuid)
    on conflict (conversation_id, entity_type, entity_id)
    do update set
      message_id = coalesce(excluded.message_id, chat_conversation_links.message_id),
      source = excluded.source,
      created_by = excluded.created_by
  `;
}

async function audit(
  tx: ChatManagerTransaction,
  actor: string,
  action: string,
  conversationId: string,
  metadata: Record<string, unknown>,
) {
  await tx`
    insert into public.audit_logs
      (actor, action, entity_type, entity_id, severity, metadata)
    values
      (${actor}::uuid, ${action}, 'conversation', ${conversationId}, 'low',
       ${JSON.stringify(metadata)}::text::jsonb)
  `;
}

/** Tasks and leads linked to a conversation, for the people who handle it. */
export const listConversationLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const rows = await withChatIdentity(context.userId, async (tx) => {
      if (!(await findHandledConversation(tx, context.userId, data.conversationId))) return null;
      return tx<ConversationLink[]>`
        select id::text, conversation_id::text, message_id::text, entity_type,
               entity_id::text, source, created_by::text, created_at::text
          from public.chat_conversation_links
         where conversation_id = ${data.conversationId}::uuid
         order by created_at desc, id desc
      `;
    });
    if (!rows) return NOT_ALLOWED;
    return { ok: true as const, links: rows };
  });

/** From a task or lead to its original conversation (the "open conversation" link). */
export const findConversationFor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ entityType: z.enum(["task", "lead"]), entityId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const rows = await withChatIdentity(
      context.userId,
      (tx) =>
        tx<
          {
            conversation_id: string;
            message_id: string | null;
            manager_access: boolean;
          }[]
        >`
        select l.conversation_id::text, l.message_id::text,
               public.has_permission(${context.userId}::uuid, 'chat.manage') as manager_access
          from public.chat_conversation_links l
          join public.conversations c on c.id = l.conversation_id
         where l.entity_type = ${data.entityType} and l.entity_id = ${data.entityId}::uuid
           and (
             public.has_permission(${context.userId}::uuid, 'chat.manage')
             or (
               public.has_permission(${context.userId}::uuid, 'conversation.manage')
               and public.is_participant(c.id, ${context.userId}::uuid)
             )
           )
         order by l.created_at desc
         limit 1
      `,
    );
    const first = rows[0];
    if (!first) return { ok: false as const, error: "No conversation is linked." };
    return { ok: true as const, ...first };
  });

/** Attach an existing task or lead to the conversation it came from. */
export const linkConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    linkInput
      .extend({ entityType: z.enum(["task", "lead"]), entityId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const entityExists = await withChatIdentity(context.userId, async (tx) => {
      if (!(await findHandledConversation(tx, context.userId, data.conversationId))) {
        return false;
      }
      const rows =
        data.entityType === "task"
          ? await tx<{ id: string }[]>`
              select id::text from public.tm_tasks where id = ${data.entityId}::uuid
            `
          : await tx<{ id: string }[]>`
              select id::text from public.leads where id = ${data.entityId}::uuid
            `;
      return rows.length > 0;
    });
    if (!entityExists)
      return { ok: false as const, error: `That ${data.entityType} does not exist.` };

    const linked = await withChatIdentity(context.userId, async (tx) => {
      if (!(await findHandledConversation(tx, context.userId, data.conversationId))) return false;
      await recordLink(tx, {
        conversationId: data.conversationId,
        messageId: data.messageId ?? null,
        entityType: data.entityType,
        entityId: data.entityId,
        actorId: context.userId,
        source: "chat_manager",
      });
      await audit(tx, context.userId, `chat.${data.entityType}.linked`, data.conversationId, {
        entity_id: data.entityId,
        message_id: data.messageId ?? null,
      });
      return true;
    });
    if (!linked) return NOT_ALLOWED;
    return { ok: true as const };
  });

/**
 * Raise a task through Task Manager's own openTask, so its rules (who may open
 * tasks, code, SLA, buzzer, and audit) continue to apply.
 */
export const createTaskFromConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    linkInput
      .extend({
        title: z.string().trim().min(3).max(300).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const conversation = await handledConversation(
      context.userId,
      data.conversationId,
      data.messageId ?? null,
    );
    if (!conversation) return NOT_ALLOWED;

    const opened = await openTask({
      data: {
        title: data.title ?? conversation.subject,
        description: `Raised from Chat conversation ${data.conversationId}.`,
        module: "chat",
        priority: data.priority,
        category: "support",
        billable: false,
      },
    });
    if (!opened.ok) {
      return {
        ok: false as const,
        error: "reason" in opened ? String(opened.reason) : "Task could not be opened.",
      };
    }

    await withChatIdentity(context.userId, async (tx) => {
      if (!(await findHandledConversation(tx, context.userId, data.conversationId))) {
        throw new Error(
          "You lost access to this conversation after Task Manager created the task; the task remains available in Task Manager.",
        );
      }
      const updated = await tx<{ id: string }[]>`
        update public.tm_tasks
           set source_reference = ${`chat:${data.conversationId}`}
         where id = ${opened.taskId}::uuid
         returning id::text
      `;
      if (updated.length === 0) {
        throw new Error(
          "Task Manager created the task, but its Chat source reference could not be saved.",
        );
      }
      await recordLink(tx, {
        conversationId: data.conversationId,
        messageId: data.messageId ?? null,
        entityType: "task",
        entityId: opened.taskId,
        actorId: context.userId,
        source: "chat_manager",
      });
      await audit(tx, context.userId, "chat.task.created", data.conversationId, {
        task_id: opened.taskId,
      });
    });
    return { ok: true as const, taskId: opened.taskId, code: opened.code };
  });

/** Record the conversation's customer as a lead (once) and link it back. */
export const createLeadFromConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => linkInput.parse(input))
  .handler(async ({ data, context }) => {
    return withChatIdentity(context.userId, async (tx) => {
      const conversation = await findHandledConversation(tx, context.userId, data.conversationId);
      if (!conversation) return NOT_ALLOWED;
      const result = await ensureLeadForConversation(tx, {
        conversationId: data.conversationId,
        customerId: conversation.created_by,
        subject: conversation.subject,
        actorId: context.userId,
        messageId: data.messageId ?? null,
        source: "chat_manager",
      });
      if (result.ok && result.created) {
        await audit(tx, context.userId, "chat.lead.created", data.conversationId, {
          lead_id: result.leadId,
        });
      }
      return result;
    });
  });
