import { supabase } from "@/integrations/supabase/client";
import type {
  Attachment,
  ChatMessage,
  ConversationSummary,
  MediaKind,
  Participant,
  Profile,
  Reaction,
  Receipt,
} from "./types";

/** Data-access layer for the user chat. Components never talk to the database directly. */

export async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, job_title, avatar_path, presence, last_seen_at")
    .in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p as Profile]));
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, job_title, avatar_path, presence, last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "job_title" | "handle" | "avatar_path">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, handle, display_name, job_title, avatar_path, presence, last_seen_at")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchMyPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) throw roleError;
  const roles = (roleRows ?? []).map((r) => r.role as string);
  if (roles.length === 0) return { roles, permissions: [] };
  const { data: permRows, error: permError } = await supabase
    .from("role_permissions")
    .select("permission, role")
    .in("role", roles as never[]);
  if (permError) throw permError;
  return { roles, permissions: Array.from(new Set((permRows ?? []).map((p) => p.permission))) };
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id, role_label, favorite, muted, last_read_at")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (ids.length === 0) return [];

  const [{ data: conversations, error: convError }, { data: allParticipants, error: partError }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select(
          "id, subject, kind, reference_code, created_by, created_at, last_message_at, ai_enabled, status, priority, department",
        )
        .in("id", ids)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id, role_label, favorite, muted, last_read_at")
        .in("conversation_id", ids),
    ]);
  if (convError) throw convError;
  if (partError) throw partError;

  const profiles = await fetchProfiles((allParticipants ?? []).map((p) => p.user_id));

  const { data: recentMessages, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, kind, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(600);
  if (messageError) throw messageError;

  const membershipByConversation = new Map(
    (memberships ?? []).map((m) => [m.conversation_id, m as Omit<Participant, "profile">]),
  );

  return (conversations ?? []).map((c) => {
    const participants: Participant[] = (allParticipants ?? [])
      .filter((p) => p.conversation_id === c.id)
      .map((p) => ({ ...(p as Omit<Participant, "profile">), profile: profiles.get(p.user_id) ?? null }));
    const membershipRow = membershipByConversation.get(c.id) ?? null;
    const membership: Participant | null = membershipRow
      ? { ...membershipRow, profile: profiles.get(userId) ?? null }
      : null;
    const conversationMessages = (recentMessages ?? []).filter((m) => m.conversation_id === c.id);
    const lastMessage = conversationMessages[0] ?? null;
    const lastReadAt = membership ? new Date(membership.last_read_at).getTime() : 0;
    const unreadCount = conversationMessages.filter(
      (m) => m.sender_id !== userId && new Date(m.created_at).getTime() > lastReadAt,
    ).length;
    return { ...c, participants, membership, lastMessage, unreadCount } as ConversationSummary;
  });
}

export async function fetchMessages(conversationId: string, userId: string): Promise<ChatMessage[]> {
  const { data: rows, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, parent_id, kind, body, client_ref, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const messages = rows ?? [];
  if (messages.length === 0) return [];
  const messageIds = messages.map((m) => m.id);

  const [attachments, reactions, receipts, mentions, bookmarks] = await Promise.all([
    supabase.from("message_attachments").select("*").in("message_id", messageIds),
    supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", messageIds),
    supabase
      .from("message_receipts")
      .select("message_id, user_id, delivered_at, read_at")
      .in("message_id", messageIds),
    supabase.from("message_mentions").select("message_id, user_id").in("message_id", messageIds),
    supabase
      .from("message_bookmarks")
      .select("message_id, pinned")
      .eq("user_id", userId)
      .in("message_id", messageIds),
  ]);
  for (const result of [attachments, reactions, receipts, mentions, bookmarks]) {
    if (result.error) throw result.error;
  }

  const replyCounts = new Map<string, number>();
  for (const m of messages) {
    if (m.parent_id) replyCounts.set(m.parent_id, (replyCounts.get(m.parent_id) ?? 0) + 1);
  }

  return messages.map((m) => ({
    ...m,
    attachments: ((attachments.data ?? []) as Attachment[]).filter((a) => a.message_id === m.id),
    reactions: ((reactions.data ?? []) as Reaction[]).filter((r) => r.message_id === m.id),
    receipts: ((receipts.data ?? []) as Receipt[]).filter((r) => r.message_id === m.id),
    mentions: (mentions.data ?? []).filter((x) => x.message_id === m.id).map((x) => x.user_id),
    bookmarked: (bookmarks.data ?? []).some((b) => b.message_id === m.id),
    pinned: (bookmarks.data ?? []).some((b) => b.message_id === m.id && b.pinned),
    replyCount: replyCounts.get(m.id) ?? 0,
  }));
}

export async function insertMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  parentId?: string | null | undefined;
  kind?: string | undefined;
  clientRef: string;
  mentions?: string[] | undefined;
}) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body: input.body,
      parent_id: input.parentId ?? null,
      kind: input.kind ?? "text",
      client_ref: input.clientRef,
    })
    .select("id, conversation_id, sender_id, parent_id, kind, body, client_ref, created_at")
    .single();
  if (error) throw error;
  if (input.mentions && input.mentions.length > 0) {
    const { error: mentionError } = await supabase
      .from("message_mentions")
      .insert(input.mentions.map((user_id) => ({ message_id: data.id, user_id })));
    if (mentionError) throw mentionError;
  }
  return data;
}

export async function insertAttachmentRecord(input: {
  messageId: string;
  conversationId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  mediaKind: MediaKind;
}) {
  const { data, error } = await supabase
    .from("message_attachments")
    .insert({
      message_id: input.messageId,
      conversation_id: input.conversationId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      media_kind: input.mediaKind,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Attachment;
}

export async function acknowledgeMessages(messageIds: string[], userId: string, read: boolean) {
  if (messageIds.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("message_receipts").upsert(
    messageIds.map((message_id) => ({
      message_id,
      user_id: userId,
      delivered_at: now,
      read_at: read ? now : null,
    })),
    { onConflict: "message_id,user_id" },
  );
  if (error) throw error;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji: string, active: boolean) {
  if (active) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error) throw error;
}

export async function setBookmark(messageId: string, userId: string, pinned: boolean, active: boolean) {
  if (active) {
    const { error } = await supabase
      .from("message_bookmarks")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("message_bookmarks")
    .upsert({ message_id: messageId, user_id: userId, pinned }, { onConflict: "message_id,user_id" });
  if (error) throw error;
}

export async function setFavorite(conversationId: string, userId: string, favorite: boolean) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ favorite })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setMuted(conversationId: string, userId: string, muted: boolean) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function searchMessages(term: string, conversationId?: string) {
  const query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .ilike("body", `%${term}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data, error } = conversationId ? await query.eq("conversation_id", conversationId) : await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSharedMedia(conversationId: string) {
  const { data, error } = await supabase
    .from("message_attachments")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

export async function searchDirectory(term: string, excludeId: string): Promise<Profile[]> {
  const clean = term.trim();
  let query = supabase
    .from("profiles")
    .select("id, handle, display_name, job_title, avatar_path, presence, last_seen_at")
    .neq("id", excludeId)
    .limit(12);
  if (clean) query = query.or(`handle.ilike.%${clean}%,display_name.ilike.%${clean}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function createConversation(input: {
  subject: string;
  kind: string;
  referenceCode?: string | null | undefined;
  createdBy: string;
  participantIds: string[];
}) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      subject: input.subject,
      kind: input.kind,
      reference_code: input.referenceCode ?? null,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  const members = Array.from(new Set([input.createdBy, ...input.participantIds]));
  const { error: participantError } = await supabase
    .from("conversation_participants")
    .insert(members.map((user_id) => ({ conversation_id: data.id, user_id })));
  if (participantError) throw participantError;
  return data.id as string;
}

export async function updatePresence(userId: string, presence: "online" | "away" | "offline") {
  await supabase
    .from("profiles")
    .update({ presence, last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function createSignedUrl(bucket: string, path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
