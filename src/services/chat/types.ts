import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  job_title: string | null;
  avatar_path: string | null;
  presence: string;
  last_seen_at: string;
}

export interface Participant {
  conversation_id: string;
  user_id: string;
  role_label: string | null;
  favorite: boolean;
  muted: boolean;
  last_read_at: string;
  profile: Profile | null;
}

export interface ConversationSummary {
  id: string;
  subject: string;
  kind: string;
  reference_code: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  participants: Participant[];
  membership: Participant | null;
  lastMessage: { id: string; body: string; kind: string; created_at: string; sender_id: string } | null;
  unreadCount: number;
}

export type MediaKind = "image" | "video" | "audio" | "voice" | "document" | "file";

export interface Attachment {
  id: string;
  message_id: string;
  conversation_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  media_kind: MediaKind;
  duration_seconds: number | null;
  created_at: string;
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface Receipt {
  message_id: string;
  user_id: string;
  delivered_at: string;
  read_at: string | null;
}

export type DeliveryState = "pending" | "sent" | "delivered" | "read" | "failed";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  parent_id: string | null;
  kind: string;
  body: string;
  client_ref: string | null;
  created_at: string;
  attachments: Attachment[];
  reactions: Reaction[];
  receipts: Receipt[];
  mentions: string[];
  bookmarked: boolean;
  pinned: boolean;
  replyCount: number;
  /** Present only for optimistic rows that have not been persisted yet. */
  optimistic?: { state: DeliveryState; error?: string | undefined } | undefined;
}

export interface DraftAttachment {
  id: string;
  file: File;
  progress: number;
  state: "queued" | "uploading" | "done" | "failed" | "cancelled";
  error?: string | undefined;
  storagePath?: string | undefined;
  mediaKind: MediaKind;
}

export function mediaKindFor(mime: string, fileName: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return fileName.startsWith("voice-") ? "voice" : "audio";
  if (
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    mime.includes("word") ||
    mime.includes("sheet") ||
    mime.includes("presentation")
  )
    return "document";
  return "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
