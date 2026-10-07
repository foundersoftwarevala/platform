import { supabase } from "@/integrations/supabase/client";
import {
  acknowledgeUserChatMessages,
  addUserChatAttachment,
  createUserChatConversation,
  getUserChatAttachmentUrl,
  getUserChatConversations,
  getUserChatMessages,
  getUserChatPermissions,
  getUserChatProfile,
  getUserChatProfiles,
  getUserChatSharedMedia,
  markUserChatConversationRead,
  prepareUserChatUpload,
  searchUserChatDirectory,
  searchUserChatMessages,
  sendUserChatMessage,
  translateUserChatMessages,
  updateUserChatBookmark,
  updateUserChatMembership,
  updateUserChatPresence,
  updateUserChatProfile,
  updateUserChatReaction,
  type ChatTranslation,
} from "@/lib/chat/user-data.functions";
import type { ChatMessage, ConversationSummary, MediaKind, Profile } from "./types";
import { storageUrl } from "./upload";

/** Data-access layer for the user chat. Components never talk to the database directly. */

export async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const data = await getUserChatProfiles({ data: { ids: unique } });
  return new Map(data.map((profile) => [profile.id, profile]));
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  void userId;
  return getUserChatProfile();
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "job_title" | "handle" | "avatar_path">>,
): Promise<Profile> {
  void userId;
  return updateUserChatProfile({ data: patch });
}

export async function fetchMyPermissions(
  userId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  void userId;
  return getUserChatPermissions();
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  void userId;
  return getUserChatConversations();
}

/** Latest `limit` messages, oldest first. Older history is loaded on request, never all at once. */
export async function fetchMessages(
  conversationId: string,
  userId: string,
  limit = 100,
): Promise<ChatMessage[]> {
  void userId;
  return getUserChatMessages({ data: { conversationId, limit } });
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
  const { senderId, ...payload } = input;
  void senderId;
  return sendUserChatMessage({ data: payload });
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
  return addUserChatAttachment({
    data: {
      ...input,
      mediaKind: input.mediaKind,
    },
  });
}

export async function acknowledgeMessages(messageIds: string[], userId: string, read: boolean) {
  if (messageIds.length === 0) return;
  void userId;
  await acknowledgeUserChatMessages({ data: { messageIds, read } });
}

export async function markConversationRead(conversationId: string, userId: string) {
  void userId;
  await markUserChatConversationRead({ data: { conversationId } });
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
  active: boolean,
) {
  void userId;
  await updateUserChatReaction({ data: { messageId, emoji, active } });
}

export async function setBookmark(
  messageId: string,
  userId: string,
  pinned: boolean,
  active: boolean,
) {
  void userId;
  await updateUserChatBookmark({ data: { messageId, pinned, active } });
}

export async function setFavorite(conversationId: string, userId: string, favorite: boolean) {
  void userId;
  await updateUserChatMembership({ data: { conversationId, favorite } });
}

export async function setMuted(conversationId: string, userId: string, muted: boolean) {
  void userId;
  await updateUserChatMembership({ data: { conversationId, muted } });
}

export async function searchMessages(term: string, conversationId?: string) {
  return searchUserChatMessages({
    data: { term, ...(conversationId ? { conversationId } : {}) },
  });
}

export async function fetchSharedMedia(conversationId: string) {
  return getUserChatSharedMedia({ data: { conversationId } });
}

export async function searchDirectory(term: string, excludeId: string): Promise<Profile[]> {
  void excludeId;
  return searchUserChatDirectory({ data: { term } });
}

export async function createConversation(input: {
  subject: string;
  kind: string;
  referenceCode?: string | null | undefined;
  createdBy: string;
  participantIds: string[];
}) {
  void input.createdBy;
  return createUserChatConversation({
    data: {
      subject: input.subject,
      kind: input.kind,
      referenceCode: input.referenceCode ?? null,
      participantIds: input.participantIds,
    },
  });
}

export async function updatePresence(userId: string, presence: "online" | "away" | "offline") {
  void userId;
  await updateUserChatPresence({ data: { presence } });
}

export async function createSignedUrl(bucket: string, path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** A one-time upload slot for a file on one of my messages, authorized by the server. */
export async function prepareUpload(input: {
  conversationId: string;
  messageId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<{ path: string; signedPath: string }> {
  return prepareUserChatUpload({ data: input });
}

/** A short-lived URL for a chat attachment; `download` saves it as a file. */
export async function attachmentUrl(attachmentId: string, download = false): Promise<string> {
  const { signedPath } = await getUserChatAttachmentUrl({ data: { attachmentId, download } });
  return storageUrl(signedPath);
}

/** Stored translations of messages into a language (see translateUserChatMessages). */
export async function translateChatMessages(
  conversationId: string,
  messageIds: string[],
  target: string,
  retry = false,
): Promise<ChatTranslation[]> {
  return translateUserChatMessages({ data: { conversationId, messageIds, target, retry } });
}
