import type { ChatManagerTransaction } from "@/lib/chat/manager-db.server";

export const LINK_COLUMNS =
  "id, conversation_id, message_id, entity_type, entity_id, source, created_by, created_at";

export type ConversationLink = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  entity_type: "task" | "lead";
  entity_id: string;
  source: string;
  created_by: string | null;
  created_at: string;
};

type EnsureLeadInput = {
  conversationId: string;
  customerId: string;
  subject: string;
  actorId: string;
  messageId: string | null;
  source: "chat_manager" | "ai_assistant";
};

export async function validateConversationMessage(
  tx: ChatManagerTransaction,
  conversationId: string,
  messageId: string | null,
): Promise<void> {
  if (!messageId) return;
  const [message] = await tx<{ id: string }[]>`
    select id::text
      from public.messages
     where id = ${messageId}::uuid and conversation_id = ${conversationId}::uuid
  `;
  if (!message) throw new Error("The selected message is not part of this conversation.");
}

export async function ensureLeadForConversation(
  tx: ChatManagerTransaction,
  input: EnsureLeadInput,
): Promise<{ ok: true; created: boolean; leadId: string } | { ok: false; error: string }> {
  const [conversation] = await tx<{ id: string }[]>`
    select id::text from public.conversations where id = ${input.conversationId}::uuid for update
  `;
  if (!conversation) throw new Error("Conversation not found.");

  await validateConversationMessage(tx, input.conversationId, input.messageId);

  const [existing] = await tx<{ entity_id: string }[]>`
    select entity_id::text
      from public.chat_conversation_links
     where conversation_id = ${input.conversationId}::uuid and entity_type = 'lead'
     order by created_at
     limit 1
  `;
  if (existing) return { ok: true, created: false, leadId: existing.entity_id };

  const [customer] = await tx<{ email: string | null; display_name: string | null }[]>`
    select u.email,
           coalesce(nullif(p.display_name, ''), u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as display_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = ${input.customerId}::uuid
  `;
  if (!customer?.email)
    return { ok: false, error: "The conversation customer has no email address." };

  const [lead] = await tx<{ id: string }[]>`
    insert into public.leads
      (name, email, source, sub_source, cta_action, source_page, requirements)
    values
      (${customer.display_name ?? "Chat customer"}, ${customer.email}, 'website',
       'Chat with Us', 'chat', '/chat', ${input.subject})
    returning id::text
  `;
  if (!lead) throw new Error("The Chat lead could not be created.");

  await tx`
    insert into public.chat_conversation_links
      (conversation_id, message_id, entity_type, entity_id, source, created_by)
    values
      (${input.conversationId}::uuid, ${input.messageId}::uuid, 'lead',
       ${lead.id}::uuid, ${input.source}, ${input.actorId}::uuid)
  `;
  return { ok: true, created: true, leadId: lead.id };
}
