import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatRateLimit } from "@/lib/chat/limits.server";

/**
 * Opens (or returns) the one Software Vala support conversation of the signed-in
 * person. This is how someone who does not run conversations starts a chat:
 * they never pick participants, so the only counterpart is Software Vala.
 *
 * It runs in the canonical Chat database as the trusted server, because the
 * database rules deliberately stop such a person from adding anyone but
 * themselves. Who may start it is still decided here, from the caller's own
 * verified permission. A conversation that was closed or resolved is history:
 * the next message starts a new one rather than landing in a thread that
 * refuses it.
 */
export const openSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const limited = chatRateLimit("openConversation", userId);
    if (!limited.ok) return { ok: false as const, error: limited.error };

    const { withChatIdentity } = await import("@/lib/chat/manager-db.server");
    const email = typeof context.claims?.email === "string" ? context.claims.email : null;
    try {
      return await withChatIdentity(
        userId,
        async (tx) => {
          const [allowed] = await tx<{ allowed: boolean }[]>`
            select public.has_permission(${userId}::uuid, 'message.send') as allowed
          `;
          if (!allowed?.allowed) {
            return { ok: false as const, error: "You do not have permission to use chat." };
          }

          // One open support conversation per person, even under concurrent clicks.
          await tx`select pg_advisory_xact_lock(hashtext('chat-support:' || ${userId}))`;
          const [existing] = await tx<{ id: string }[]>`
            select c.id::text
              from public.conversations c
             where c.created_by = ${userId}::uuid
               and c.kind = 'support'
               and c.status not in ('closed', 'resolved')
               and public.is_participant(c.id, ${userId}::uuid)
             order by c.last_message_at desc
             limit 1
          `;
          if (existing) {
            return { ok: true as const, conversationId: existing.id, created: false as const };
          }

          // Written as the trusted server, as before: the insert guard
          // (20261108T094000) rightly stops a customer's own insert from
          // switching the AI on, and this conversation is Software Vala's.
          await tx`select set_config('request.jwt.claim.sub', '', true)`;
          const [created] = await tx<{ id: string }[]>`
            insert into public.conversations
              (subject, kind, created_by, department, ai_enabled)
            values ('Software Vala Support', 'support', ${userId}::uuid, 'Support', true)
            returning id::text
          `;
          if (!created) throw new Error("Could not open the conversation.");
          await tx`
            insert into public.conversation_participants (conversation_id, user_id, role_label)
            values (${created.id}::uuid, ${userId}::uuid, 'Customer')
          `;
          await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
          await tx`
            insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
            values (${userId}, 'chat.conversation.created', 'conversation', ${created.id}, 'low',
                    ${JSON.stringify({ source: "chat_app", kind: "support" })}::text::jsonb)
          `;
          return { ok: true as const, conversationId: created.id, created: true as const };
        },
        email,
      );
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not open the conversation.",
      };
    }
  });
