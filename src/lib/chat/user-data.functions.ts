import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Attachment, ChatMessage, ConversationSummary, Profile } from "@/services/chat/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new Error(`${label} must be a valid identifier.`);
}

type ChatCaller = { userId: string; claims?: { email?: unknown } | undefined };

async function chatDatabase<T>(
  caller: ChatCaller,
  run: (tx: import("@/lib/chat/manager-db.server").ChatManagerTransaction) => Promise<T>,
): Promise<T> {
  const { withChatIdentity } = await import("@/lib/chat/manager-db.server");
  const email = typeof caller.claims?.email === "string" ? caller.claims.email : null;
  return withChatIdentity(caller.userId, run, email);
}

/** Whether the caller is a Chat manager (sees originals and moderation detail). */
async function isChatManager(
  tx: import("@/lib/chat/manager-db.server").ChatManagerTransaction,
  userId: string,
): Promise<boolean> {
  const [row] = await tx<{ allowed: boolean }[]>`
    select public.has_permission(${userId}::uuid, 'chat.manage') as allowed
  `;
  return row?.allowed === true;
}

export const getUserChatProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => {
    if (!Array.isArray(input?.ids) || input.ids.length > 100) {
      throw new Error("Profile lookup must contain at most 100 identifiers.");
    }
    const ids = Array.from(new Set(input.ids));
    ids.forEach((id) => requireUuid(id, "Profile identifier"));
    return { ids };
  })
  .handler(async ({ data, context }): Promise<Profile[]> => {
    if (data.ids.length === 0) return [];
    return chatDatabase(context, async (tx) => {
      const rows = await tx<Profile[]>`
        select p.id::text, p.handle, p.display_name, p.job_title, p.avatar_path,
               p.presence, p.last_seen_at::text as last_seen_at
          from public.profiles p
         where p.id in (
           select value::uuid from jsonb_array_elements_text(${JSON.stringify(data.ids)}::text::jsonb)
         )
           and (
             p.id = ${context.userId}::uuid
             or public.has_permission(${context.userId}::uuid, 'chat.manage')
             or exists (
               select 1
                 from public.conversation_participants mine
                 join public.conversation_participants theirs
                   on theirs.conversation_id = mine.conversation_id
                where mine.user_id = ${context.userId}::uuid
                  and theirs.user_id = p.id
             )
           )
      `;
      return rows;
    });
  });

export const getUserChatProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile | null> =>
    chatDatabase(context, async (tx) => {
      const [profile] = await tx<Profile[]>`
        select id::text, handle, display_name, job_title, avatar_path, presence,
               last_seen_at::text as last_seen_at
          from public.profiles where id = ${context.userId}::uuid
      `;
      return profile ?? null;
    }),
  );

export const getUserChatPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    chatDatabase(context, async (tx) => {
      const rows = await tx<{ role: string; permission: string }[]>`
        select ur.role::text as role, rp.permission
          from public.user_roles ur
          left join public.role_permissions rp on rp.role = ur.role
         where ur.user_id = ${context.userId}::uuid
      `;
      return {
        roles: Array.from(new Set(rows.map((row) => row.role))),
        permissions: Array.from(new Set(rows.map((row) => row.permission).filter(Boolean))),
      };
    }),
  );

export const getUserChatConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationSummary[]> =>
    chatDatabase(context, async (tx) => {
      const [result] = await tx<{ conversations: unknown }[]>`
        with mine as (
          select conversation_id, user_id, role_label, favorite, muted, last_read_at
            from public.conversation_participants
           where user_id = ${context.userId}::uuid
        ),
        visible as (
          select c.*, mine.role_label as my_role_label, mine.favorite as my_favorite,
                 mine.muted as my_muted, mine.last_read_at as my_last_read_at
            from public.conversations c
            join mine on mine.conversation_id = c.id
        )
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', c.id::text,
            'subject', c.subject,
            'kind', c.kind,
            'reference_code', c.reference_code,
            'created_by', c.created_by::text,
            'created_at', c.created_at,
            'last_message_at', c.last_message_at,
            'ai_enabled', c.ai_enabled,
            'status', c.status,
            'priority', c.priority,
            'department', c.department,
            'participants', coalesce((
              select jsonb_agg(jsonb_build_object(
                'conversation_id', cp.conversation_id::text,
                'user_id', cp.user_id::text,
                'role_label', cp.role_label,
                'favorite', cp.favorite,
                'muted', cp.muted,
                'last_read_at', cp.last_read_at,
                'profile', case when p.id is null then null else jsonb_build_object(
                  'id', p.id::text, 'handle', p.handle, 'display_name', p.display_name,
                  'job_title', p.job_title, 'avatar_path', p.avatar_path,
                  'presence', p.presence, 'last_seen_at', p.last_seen_at
                ) end
              ) order by cp.joined_at)
                from public.conversation_participants cp
                left join public.profiles p on p.id = cp.user_id
               where cp.conversation_id = c.id
            ), '[]'::jsonb),
            'membership', jsonb_build_object(
              'conversation_id', c.id::text, 'user_id', ${context.userId}::text,
              'role_label', c.my_role_label, 'favorite', c.my_favorite,
              'muted', c.my_muted, 'last_read_at', c.my_last_read_at,
              'profile', (select jsonb_build_object(
                'id', p.id::text, 'handle', p.handle, 'display_name', p.display_name,
                'job_title', p.job_title, 'avatar_path', p.avatar_path,
                'presence', p.presence, 'last_seen_at', p.last_seen_at
              ) from public.profiles p where p.id = ${context.userId}::uuid)
            ),
            'lastMessage', (select jsonb_build_object(
              'id', m.id::text, 'body', case
                when public.has_permission(${context.userId}::uuid, 'chat.manage') then m.body
                else coalesce((
                  select mm.corrected_body from public.chat_message_moderation mm
                   where mm.message_id = m.id and mm.action = 'corrected'
                ), m.body)
              end, 'kind', m.kind,
              'created_at', m.created_at, 'sender_id', m.sender_id::text
            ) from public.messages m
             where m.conversation_id = c.id
               and (public.has_permission(${context.userId}::uuid, 'chat.manage')
                    or not exists (
                      select 1 from public.chat_message_moderation mm
                       where mm.message_id = m.id and mm.action = 'hidden'
                    ))
             order by m.created_at desc, m.id desc limit 1),
            'unreadCount', (select count(*)::int from public.messages m
              where m.conversation_id = c.id and m.sender_id <> ${context.userId}::uuid
                and m.created_at > c.my_last_read_at
                and (public.has_permission(${context.userId}::uuid, 'chat.manage')
                     or not exists (
                       select 1 from public.chat_message_moderation mm
                        where mm.message_id = m.id and mm.action = 'hidden'
                     )))
          ) order by c.last_message_at desc
        ), '[]'::jsonb) as conversations
          from visible c
      `;
      return (result?.conversations ?? []) as ConversationSummary[];
    }),
  );

export const getUserChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; limit?: number }) => {
    if (!input || !UUID.test(input.conversationId)) {
      throw new Error("A valid conversation identifier is required.");
    }
    const limit = Math.max(1, Math.min(200, Math.floor(input.limit ?? 100)));
    return { conversationId: input.conversationId, limit };
  })
  .handler(async ({ data, context }): Promise<ChatMessage[]> =>
    chatDatabase(context, async (tx) => {
      const [access] = await tx<{ allowed: boolean }[]>`
        select public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid)
            or public.has_permission(${context.userId}::uuid, 'chat.manage') as allowed
      `;
      if (!access?.allowed) throw new Error("Conversation not found.");
      // A customer receives what the conversation now says: a corrected message
      // arrives as its correction, never as the original, and the moderator and
      // reason stay internal. Managers receive the original and the overlay.
      const manager = await isChatManager(tx, context.userId);
      const [result] = await tx<{ messages: unknown }[]>`
        with page as (
          select m.*
            from public.messages m
           where m.conversation_id = ${data.conversationId}::uuid
              and (public.has_permission(${context.userId}::uuid, 'chat.manage')
                   or not exists (
                     select 1 from public.chat_message_moderation mm
                      where mm.message_id = m.id and mm.action = 'hidden'
                   ))
            order by m.created_at desc, m.id desc
           limit ${data.limit}
        )
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', m.id::text, 'conversation_id', m.conversation_id::text,
            'sender_id', m.sender_id::text, 'parent_id', m.parent_id::text,
            'kind', m.kind,
            'body', case when ${manager} then m.body else coalesce((
              select mm.corrected_body from public.chat_message_moderation mm
               where mm.message_id = m.id and mm.action = 'corrected'
            ), m.body) end,
            'client_ref', m.client_ref,
            'created_at', m.created_at,
            'attachments', coalesce((select jsonb_agg(to_jsonb(a))
              from public.message_attachments a where a.message_id = m.id), '[]'::jsonb),
            'reactions', coalesce((select jsonb_agg(jsonb_build_object(
              'message_id', r.message_id::text, 'user_id', r.user_id::text, 'emoji', r.emoji
            )) from public.message_reactions r where r.message_id = m.id), '[]'::jsonb),
            'receipts', coalesce((select jsonb_agg(jsonb_build_object(
              'message_id', r.message_id::text, 'user_id', r.user_id::text,
              'delivered_at', r.delivered_at, 'read_at', r.read_at
            )) from public.message_receipts r where r.message_id = m.id), '[]'::jsonb),
            'mentions', coalesce((select jsonb_agg(mm.user_id::text)
              from public.message_mentions mm where mm.message_id = m.id), '[]'::jsonb),
            'bookmarked', exists(select 1 from public.message_bookmarks b
              where b.message_id = m.id and b.user_id = ${context.userId}::uuid),
            'pinned', coalesce((select b.pinned from public.message_bookmarks b
              where b.message_id = m.id and b.user_id = ${context.userId}::uuid), false),
            'replyCount', (select count(*)::int from public.messages child where child.parent_id = m.id),
            'moderation', (select case when ${manager} then to_jsonb(mm)
                else jsonb_build_object(
                  'message_id', mm.message_id::text, 'action', mm.action,
                  'corrected_body', mm.corrected_body, 'reason', null, 'acted_at', mm.acted_at
                ) end
              from public.chat_message_moderation mm where mm.message_id = m.id)
          ) order by m.created_at, m.id
        ), '[]'::jsonb) as messages
          from page m
      `;
      return (result?.messages ?? []) as ChatMessage[];
    }),
  );

export const sendUserChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      conversationId: string;
      body: string;
      parentId?: string | null;
      kind?: string;
      clientRef: string;
      mentions?: string[];
    }) => {
      if (!input || !UUID.test(input.conversationId)) {
        throw new Error("A valid conversation identifier is required.");
      }
      const body = input.body?.trim() ?? "";
      const kind = input.kind ?? "text";
      if ((!body && kind !== "attachment") || body.length > 12_000)
        throw new Error(
          "Message length must be 1 to 12,000 characters unless it contains attachments.",
        );
      if (!input.clientRef || input.clientRef.length > 160)
        throw new Error("A valid retry key is required.");
      if (input.parentId) requireUuid(input.parentId, "Parent message identifier");
      const mentions = Array.from(new Set(input.mentions ?? []));
      if (mentions.length > 50) throw new Error("A message can mention at most 50 participants.");
      mentions.forEach((id) => requireUuid(id, "Mention identifier"));
      if (
        !["text", "attachment", "file", "image", "video", "audio", "voice", "document"].includes(
          kind,
        )
      ) {
        throw new Error("Unsupported chat message type.");
      }
      return {
        conversationId: input.conversationId,
        body,
        parentId: input.parentId ?? null,
        kind,
        clientRef: input.clientRef,
        mentions,
      };
    },
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      Pick<
        ChatMessage,
        | "id"
        | "conversation_id"
        | "sender_id"
        | "parent_id"
        | "kind"
        | "body"
        | "client_ref"
        | "created_at"
      >
    > =>
      chatDatabase(context, async (tx) => {
        const [authorization] = await tx<{ participant: boolean; allowed: boolean }[]>`
        select public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid) as participant,
               public.has_permission(${context.userId}::uuid, 'message.send') as allowed
      `;
        if (!authorization?.participant || !authorization.allowed) {
          throw new Error("You do not have permission to send messages in this conversation.");
        }
        const [conversation] = await tx<{ open: boolean }[]>`
        select status not in ('closed', 'resolved') as open
          from public.conversations where id = ${data.conversationId}::uuid for update
      `;
        if (!conversation?.open) throw new Error("Conversation not found or closed.");
        if (data.parentId) {
          const [parent] = await tx<{ exists: boolean }[]>`
          select exists(select 1 from public.messages
            where id = ${data.parentId}::uuid and conversation_id = ${data.conversationId}::uuid) as exists
        `;
          if (!parent?.exists) throw new Error("Reply target is not in this conversation.");
        }
        if (data.mentions.length) {
          const [mentionCheck] = await tx<{ valid: boolean }[]>`
          select count(*) = jsonb_array_length(${JSON.stringify(data.mentions)}::text::jsonb) as valid
            from public.conversation_participants
           where conversation_id = ${data.conversationId}::uuid
             and user_id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(data.mentions)}::text::jsonb))
        `;
          if (!mentionCheck?.valid)
            throw new Error("A mention target is not a conversation participant.");
        }
        const [message] = await tx<ChatMessage[]>`
        insert into public.messages
          (conversation_id, sender_id, parent_id, kind, body, client_ref)
        values
          (${data.conversationId}::uuid, ${context.userId}::uuid, ${data.parentId}::uuid,
           ${data.kind}, ${data.body}, ${data.clientRef})
        on conflict (conversation_id, sender_id, client_ref) where client_ref is not null
        do update set client_ref = excluded.client_ref
        returning id::text, conversation_id::text, sender_id::text, parent_id::text,
                  kind, body, client_ref, created_at::text
      `;
        if (!message) throw new Error("The message could not be saved.");
        if (data.mentions.length) {
          await tx`
          insert into public.message_mentions (message_id, user_id)
          select ${message.id}::uuid, value::uuid
            from jsonb_array_elements_text(${JSON.stringify(data.mentions)}::text::jsonb)
          on conflict do nothing
        `;
        }
        return message;
      }),
  );

export const updateUserChatProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      display_name?: string;
      job_title?: string | null;
      handle?: string;
      avatar_path?: string | null;
    }) => {
      if (!input || Object.keys(input).length === 0)
        throw new Error("No profile changes provided.");
      const patch: Record<string, string | null> = {};
      if (input.display_name !== undefined)
        patch["display_name"] = input.display_name.trim().slice(0, 120);
      if (input.job_title !== undefined)
        patch["job_title"] = input.job_title?.trim().slice(0, 120) ?? null;
      if (input.handle !== undefined) {
        const handle = input.handle.trim().replace(/^@/, "").toLowerCase();
        if (!/^[a-z0-9_.-]{2,40}$/.test(handle)) throw new Error("Invalid profile handle.");
        patch["handle"] = handle;
      }
      if (input.avatar_path !== undefined) patch["avatar_path"] = input.avatar_path;
      return patch;
    },
  )
  .handler(async ({ data, context }): Promise<Profile> =>
    chatDatabase(context, async (tx) => {
      const [profile] = await tx<Profile[]>`
        update public.profiles
           set display_name = coalesce(${data["display_name"] ?? null}, display_name),
               job_title = case when ${Object.hasOwn(data, "job_title")} then ${data["job_title"] ?? null} else job_title end,
               handle = coalesce(${data["handle"] ?? null}, handle),
               avatar_path = case when ${Object.hasOwn(data, "avatar_path")} then ${data["avatar_path"] ?? null} else avatar_path end,
               updated_at = now()
         where id = ${context.userId}::uuid
        returning id::text, handle, display_name, job_title, avatar_path, presence,
                  last_seen_at::text as last_seen_at
      `;
      if (!profile) throw new Error("Your profile could not be found.");
      return profile;
    }),
  );

export const addUserChatAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      messageId: string;
      conversationId: string;
      storagePath: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      mediaKind: string;
    }) => {
      if (!input || !UUID.test(input.messageId) || !UUID.test(input.conversationId)) {
        throw new Error("A valid message and conversation are required.");
      }
      if (
        !input.storagePath ||
        input.storagePath.length > 1024 ||
        input.storagePath.includes("\\") ||
        input.storagePath.split("/").includes("..") ||
        !input.storagePath.startsWith(`${input.conversationId}/${input.messageId}/`) ||
        !input.fileName ||
        input.fileName.length > 255 ||
        !input.mimeType ||
        input.mimeType.length > 255 ||
        !Number.isSafeInteger(input.sizeBytes) ||
        input.sizeBytes < 0 ||
        input.sizeBytes > 25 * 1024 * 1024 ||
        !["image", "video", "audio", "voice", "document", "file"].includes(input.mediaKind)
      ) {
        throw new Error("Invalid attachment details.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<Attachment> =>
    chatDatabase(context, async (tx) => {
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'attachment.upload')
           and public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid)
           and exists (select 1 from public.messages
             where id = ${data.messageId}::uuid
               and conversation_id = ${data.conversationId}::uuid
               and sender_id = ${context.userId}::uuid) as allowed
      `;
      if (!allowed?.allowed) throw new Error("You cannot attach a file to this message.");
      const [attachment] = await tx<Attachment[]>`
        insert into public.message_attachments
          (message_id, conversation_id, storage_path, file_name, mime_type, size_bytes, media_kind)
        values
          (${data.messageId}::uuid, ${data.conversationId}::uuid, ${data.storagePath},
           ${data.fileName}, ${data.mimeType}, ${data.sizeBytes}, ${data.mediaKind})
        returning id::text, message_id::text, conversation_id::text, storage_path, file_name,
                  mime_type, size_bytes::int, media_kind, duration_seconds, created_at::text
      `;
      if (!attachment) throw new Error("Attachment could not be recorded.");
      return {
        id: attachment.id,
        message_id: attachment.message_id,
        conversation_id: attachment.conversation_id,
        storage_path: attachment.storage_path,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        size_bytes: Number(attachment.size_bytes),
        media_kind: attachment.media_kind,
        duration_seconds: attachment.duration_seconds,
        created_at: String(attachment.created_at),
      };
    }),
  );

export const acknowledgeUserChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageIds: string[]; read: boolean }) => {
    if (!Array.isArray(input?.messageIds) || input.messageIds.length > 200) {
      throw new Error("Receipt update must contain at most 200 messages.");
    }
    const messageIds = Array.from(new Set(input.messageIds));
    messageIds.forEach((id) => requireUuid(id, "Message identifier"));
    return { messageIds, read: input.read === true };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      if (data.messageIds.length === 0) return;
      const [eligible] = await tx<{ count: number; allowed: boolean }[]>`
        select count(*)::int as count,
               public.has_permission(${context.userId}::uuid, 'message.send') as allowed
          from public.messages m
          join public.conversation_participants cp
            on cp.conversation_id = m.conversation_id
           and cp.user_id = ${context.userId}::uuid
         where m.id in (
           select value::uuid from jsonb_array_elements_text(${JSON.stringify(data.messageIds)}::text::jsonb)
         )
      `;
      if (!eligible?.allowed || eligible.count !== data.messageIds.length) {
        throw new Error("One or more messages are not available for receipt updates.");
      }
      await tx`
        insert into public.message_receipts (message_id, user_id, delivered_at, read_at)
        select value::uuid, ${context.userId}::uuid, now(), case when ${data.read} then now() else null end
          from jsonb_array_elements_text(${JSON.stringify(data.messageIds)}::text::jsonb)
        on conflict (message_id, user_id) do update
          set delivered_at = excluded.delivered_at,
              read_at = coalesce(excluded.read_at, public.message_receipts.read_at)
      `;
    }),
  );

export const markUserChatConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    requireUuid(input?.conversationId, "Conversation identifier");
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const updated = await tx`
        update public.conversation_participants
           set last_read_at = now()
         where conversation_id = ${data.conversationId}::uuid
           and user_id = ${context.userId}::uuid
        returning conversation_id
      `;
      if (updated.length === 0) throw new Error("Conversation not found.");
    }),
  );

export const updateUserChatReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; emoji: string; active: boolean }) => {
    requireUuid(input?.messageId, "Message identifier");
    if (!input.emoji || input.emoji.length > 32) throw new Error("Invalid reaction.");
    return { messageId: input.messageId, emoji: input.emoji, active: input.active === true };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'message.react')
           and exists (select 1 from public.messages m
             join public.conversation_participants cp on cp.conversation_id = m.conversation_id
            where m.id = ${data.messageId}::uuid and cp.user_id = ${context.userId}::uuid) as allowed
      `;
      if (!allowed?.allowed) throw new Error("You cannot react to this message.");
      if (data.active) {
        await tx`delete from public.message_reactions
          where message_id = ${data.messageId}::uuid
            and user_id = ${context.userId}::uuid and emoji = ${data.emoji}`;
      } else {
        await tx`insert into public.message_reactions (message_id, user_id, emoji)
          values (${data.messageId}::uuid, ${context.userId}::uuid, ${data.emoji})
          on conflict do nothing`;
      }
    }),
  );

export const updateUserChatBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; pinned: boolean; active: boolean }) => {
    requireUuid(input?.messageId, "Message identifier");
    return {
      messageId: input.messageId,
      pinned: input.pinned === true,
      active: input.active === true,
    };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'message.bookmark')
           and exists (select 1 from public.messages m
             join public.conversation_participants cp on cp.conversation_id = m.conversation_id
            where m.id = ${data.messageId}::uuid and cp.user_id = ${context.userId}::uuid) as allowed
      `;
      if (!allowed?.allowed) throw new Error("You cannot bookmark this message.");
      if (data.active) {
        await tx`delete from public.message_bookmarks
          where message_id = ${data.messageId}::uuid and user_id = ${context.userId}::uuid`;
      } else {
        await tx`insert into public.message_bookmarks (message_id, user_id, pinned)
          values (${data.messageId}::uuid, ${context.userId}::uuid, ${data.pinned})
          on conflict (message_id, user_id) do update set pinned = excluded.pinned`;
      }
    }),
  );

export const updateUserChatMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; favorite?: boolean; muted?: boolean }) => {
    requireUuid(input?.conversationId, "Conversation identifier");
    if (input.favorite === undefined && input.muted === undefined) {
      throw new Error("No conversation preference was provided.");
    }
    return {
      conversationId: input.conversationId,
      ...(input.favorite === undefined ? {} : { favorite: input.favorite }),
      ...(input.muted === undefined ? {} : { muted: input.muted }),
    };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const [membership] = await tx<{ conversation_id: string }[]>`
        update public.conversation_participants
           set favorite = coalesce(${data.favorite ?? null}, favorite),
               muted = coalesce(${data.muted ?? null}, muted)
         where conversation_id = ${data.conversationId}::uuid
           and user_id = ${context.userId}::uuid
        returning conversation_id::text
      `;
      if (!membership) throw new Error("Conversation not found.");
    }),
  );

export const searchUserChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string; conversationId?: string }) => {
    const term = input?.term?.trim().slice(0, 120);
    if (!term) throw new Error("Enter text to search.");
    if (input.conversationId) requireUuid(input.conversationId, "Conversation identifier");
    return { term, ...(input.conversationId ? { conversationId: input.conversationId } : {}) };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'search.messages')
          and (${data.conversationId ?? null}::uuid is null or public.is_participant(
            ${data.conversationId ?? null}::uuid, ${context.userId}::uuid)) as allowed
      `;
      if (!allowed?.allowed)
        throw new Error("You do not have permission to search these messages.");
      return tx`
        select m.id::text, m.conversation_id::text, m.sender_id::text,
               coalesce((
                 select mm.corrected_body from public.chat_message_moderation mm
                  where mm.message_id = m.id and mm.action = 'corrected'
               ), m.body) as body,
               m.created_at::text
          from public.messages m
         where coalesce((
                 select mm.corrected_body from public.chat_message_moderation mm
                  where mm.message_id = m.id and mm.action = 'corrected'
               ), m.body) ilike ${`%${data.term}%`}
           and public.is_participant(m.conversation_id, ${context.userId}::uuid)
           and not exists (
             select 1 from public.chat_message_moderation mm
              where mm.message_id = m.id and mm.action = 'hidden'
           )
           and (${data.conversationId ?? null}::uuid is null or m.conversation_id = ${data.conversationId ?? null}::uuid)
         order by m.created_at desc limit 50
      `;
    }),
  );

export const getUserChatSharedMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    requireUuid(input?.conversationId, "Conversation identifier");
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data, context }): Promise<Attachment[]> =>
    chatDatabase(context, async (tx) => {
      const [participant] = await tx<{ allowed: boolean }[]>`
        select public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid) as allowed
      `;
      if (!participant?.allowed) throw new Error("Conversation not found.");
      return tx<Attachment[]>`
        select a.* from public.message_attachments a
         join public.messages m on m.id = a.message_id
         where a.conversation_id = ${data.conversationId}::uuid
           and not exists (
             select 1 from public.chat_message_moderation mm
              where mm.message_id = m.id and mm.action = 'hidden'
           )
         order by a.created_at desc
      `;
    }),
  );

export const searchUserChatDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string }) => ({
    term: (input?.term ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }): Promise<Profile[]> =>
    chatDatabase(context, async (tx) => {
      // The directory is for people who choose participants. A customer never
      // does (the server opens their support conversation), so a customer
      // cannot list the platform's accounts.
      const [runner] = await tx<{ allowed: boolean }[]>`
        select public.chat_can_run_conversations(${context.userId}::uuid) as allowed
      `;
      if (!runner?.allowed) return [];
      if (data.term) {
        return tx<Profile[]>`
          select id::text, handle, display_name, job_title, avatar_path, presence,
                 last_seen_at::text as last_seen_at
            from public.profiles
           where id <> ${context.userId}::uuid
             and (handle ilike ${`%${data.term}%`} or display_name ilike ${`%${data.term}%`})
           order by display_name nulls last limit 12
        `;
      }
      return tx<Profile[]>`
        select id::text, handle, display_name, job_title, avatar_path, presence,
               last_seen_at::text as last_seen_at
          from public.profiles where id <> ${context.userId}::uuid
         order by display_name nulls last limit 12
      `;
    }),
  );

export const updateUserChatPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { presence: "online" | "away" | "offline" }) => {
    if (!["online", "away", "offline"].includes(input?.presence)) {
      throw new Error("Invalid presence state.");
    }
    return { presence: input.presence };
  })
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      await tx`update public.profiles
        set presence = ${data.presence}, last_seen_at = now()
        where id = ${context.userId}::uuid`;
    }),
  );

export const createUserChatConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subject: string;
      kind: string;
      referenceCode?: string | null;
      participantIds: string[];
    }) => {
      const subject = input?.subject?.trim();
      if (!subject || subject.length > 240) throw new Error("Conversation subject is required.");
      if (!["direct", "group", "channel", "support"].includes(input.kind)) {
        throw new Error("Unsupported conversation type.");
      }
      if (!Array.isArray(input.participantIds) || input.participantIds.length > 50) {
        throw new Error("A conversation can have at most 50 participants.");
      }
      const participantIds = Array.from(new Set(input.participantIds));
      participantIds.forEach((id) => requireUuid(id, "Participant identifier"));
      return {
        subject,
        kind: input.kind,
        referenceCode: input.referenceCode?.trim().slice(0, 120) || null,
        participantIds,
      };
    },
  )
  .handler(async ({ data, context }) =>
    chatDatabase(context, async (tx) => {
      const [authorization] = await tx<{ can_create: boolean; can_run: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'conversation.create') as can_create,
               public.chat_can_run_conversations(${context.userId}::uuid) as can_run
      `;
      if (!authorization?.can_create) throw new Error("You cannot create conversations.");
      if (!authorization.can_run && data.kind !== "support") {
        throw new Error("Only Software Vala staff can create internal conversations.");
      }
      if (!authorization.can_run && data.participantIds.some((id) => id !== context.userId)) {
        throw new Error("Only Software Vala staff can choose conversation participants.");
      }
      const participants = Array.from(new Set([context.userId, ...data.participantIds]));
      const [conversation] = await tx<{ id: string }[]>`
        insert into public.conversations
          (subject, kind, reference_code, created_by)
        values
          (${data.subject}, ${data.kind}, ${data.referenceCode}, ${context.userId}::uuid)
        returning id::text
      `;
      if (!conversation) throw new Error("Conversation could not be created.");
      await tx`
        insert into public.conversation_participants (conversation_id, user_id)
        select ${conversation.id}::uuid, value::uuid
          from jsonb_array_elements_text(${JSON.stringify(participants)}::text::jsonb)
        on conflict (conversation_id, user_id) do nothing
      `;
      return conversation.id;
    }),
  );

/**
 * A one-time upload slot for a file on the caller's own message. Authorized
 * against the canonical conversation; the bytes go to the existing bucket.
 */
export const prepareUserChatUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; messageId: string; fileName: string; sizeBytes: number }) => {
      if (!input || !UUID.test(input.conversationId) || !UUID.test(input.messageId)) {
        throw new Error("A valid message and conversation are required.");
      }
      const fileName = (input.fileName ?? "").trim();
      if (!fileName || fileName.length > 255) throw new Error("Invalid file name.");
      if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
        throw new Error("Invalid file size.");
      }
      return {
        conversationId: input.conversationId,
        messageId: input.messageId,
        fileName,
        sizeBytes: input.sizeBytes,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { CHAT_FILE_MAX_BYTES, signChatUpload } = await import("@/lib/chat/storage.server");
    if (data.sizeBytes > CHAT_FILE_MAX_BYTES) {
      throw new Error("Files can be at most 25 MB.");
    }
    await chatDatabase(context, async (tx) => {
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select public.has_permission(${context.userId}::uuid, 'attachment.upload')
           and public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid)
           and exists (select 1 from public.messages
             where id = ${data.messageId}::uuid
               and conversation_id = ${data.conversationId}::uuid
               and sender_id = ${context.userId}::uuid) as allowed
      `;
      if (!allowed?.allowed) throw new Error("You cannot attach a file to this message.");
    });
    const safeName = data.fileName.replace(/[^\w.-]+/g, "_").slice(0, 180);
    const path = `${data.conversationId}/${data.messageId}/${crypto.randomUUID()}-${safeName}`;
    return signChatUpload(path);
  });

/**
 * A short-lived URL for one attachment: to view, for anyone who may read the
 * conversation; to download (save as a file), only with attachment.download.
 */
export const getUserChatAttachmentUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attachmentId: string; download?: boolean }) => {
    requireUuid(input?.attachmentId, "Attachment identifier");
    return { attachmentId: input.attachmentId, download: input.download === true };
  })
  .handler(async ({ data, context }) => {
    const attachment = await chatDatabase(context, async (tx) => {
      const [row] = await tx<
        { storage_path: string; file_name: string; can_read: boolean; can_download: boolean }[]
      >`
        select a.storage_path, a.file_name,
               (public.is_participant(a.conversation_id, ${context.userId}::uuid)
                  and not exists (
                    select 1 from public.chat_message_moderation mm
                     where mm.message_id = a.message_id and mm.action = 'hidden'
                  ))
               or public.has_permission(${context.userId}::uuid, 'chat.manage') as can_read,
               public.has_permission(${context.userId}::uuid, 'attachment.download') as can_download
          from public.message_attachments a
         where a.id = ${data.attachmentId}::uuid
      `;
      return row ?? null;
    });
    if (!attachment?.can_read) throw new Error("Attachment not found.");
    if (data.download && !attachment.can_download) {
      throw new Error("You do not have permission to download files.");
    }
    const { signChatDownload } = await import("@/lib/chat/storage.server");
    return {
      signedPath: await signChatDownload(
        attachment.storage_path,
        data.download ? attachment.file_name : undefined,
      ),
    };
  });

export type ChatTranslation = {
  messageId: string;
  status: "pending" | "processing" | "completed" | "failed" | "retrying";
  text: string | null;
  sourceLanguage: string | null;
  identity: boolean;
  error: string | null;
  retryAfterMs: number | null;
};

/**
 * Messages of one conversation in the reader's language, through the Chat
 * translation pipeline: the source language is detected, the message is put
 * into canonical English once, and English into the reader's language once per
 * language; each step is stored against the message (chat_message_translations)
 * and the original is never changed. A message a manager corrected is
 * translated from its correction and not stored, since the stored rows belong
 * to the original text.
 */
export const translateUserChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; messageIds: string[]; target: string; retry?: boolean }) => {
      requireUuid(input?.conversationId, "Conversation identifier");
      if (!Array.isArray(input.messageIds) || input.messageIds.length === 0) {
        throw new Error("Choose at least one message to translate.");
      }
      if (input.messageIds.length > 20) throw new Error("Translate at most 20 messages at once.");
      const messageIds = Array.from(new Set(input.messageIds));
      messageIds.forEach((id) => requireUuid(id, "Message identifier"));
      const target = (input.target ?? "").trim();
      if (!/^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})*$/.test(target)) {
        throw new Error("That language is not supported.");
      }
      return {
        conversationId: input.conversationId,
        messageIds,
        target,
        retry: input.retry === true,
      };
    },
  )
  .handler(async ({ data, context }): Promise<ChatTranslation[]> => {
    const { chatRateLimit } = await import("@/lib/chat/limits.server");
    const limited = chatRateLimit("translate", context.userId);
    if (!limited.ok) throw new Error(limited.error);

    const rows = await chatDatabase(context, async (tx) => {
      const [access] = await tx<{ allowed: boolean; manager: boolean }[]>`
        select public.is_participant(${data.conversationId}::uuid, ${context.userId}::uuid)
               or public.has_permission(${context.userId}::uuid, 'chat.manage') as allowed,
               public.has_permission(${context.userId}::uuid, 'chat.manage') as manager
      `;
      if (!access?.allowed) throw new Error("Conversation not found.");
      return tx<{ id: string; body: string; corrected: string | null }[]>`
        select m.id::text, m.body,
               case when ${access.manager} then null else mm.corrected_body end as corrected
          from public.messages m
          left join public.chat_message_moderation mm on mm.message_id = m.id
         where m.conversation_id = ${data.conversationId}::uuid
           and m.id in (
             select value::uuid from jsonb_array_elements_text(${JSON.stringify(data.messageIds)}::text::jsonb)
           )
           and (${access.manager} or mm.action is distinct from 'hidden')
      `;
    });

    const { translateMessages, translateTransient } = await import("@/lib/chat/translation.server");
    const stored = rows.filter((row) => row.corrected === null && row.body.trim());
    const views = stored.length
      ? await translateMessages({
          userId: context.userId,
          messages: stored.map((row) => ({ id: row.id, body: row.body })),
          target: data.target,
          retry: data.retry,
        })
      : [];
    const results: ChatTranslation[] = views.map((view) => ({
      messageId: view.messageId,
      status: view.status,
      text: view.text,
      sourceLanguage: view.sourceLanguage,
      identity: view.identity,
      error: view.error,
      retryAfterMs: view.retryAfterMs,
    }));
    for (const row of rows) {
      if (row.corrected === null) continue;
      const transient = await translateTransient(context.userId, row.corrected, data.target);
      results.push({
        messageId: row.id,
        status: transient.ok ? "completed" : "failed",
        text: transient.ok ? transient.text : null,
        sourceLanguage: null,
        identity: false,
        error: transient.ok ? null : transient.error,
        retryAfterMs: null,
      });
    }
    return results;
  });
