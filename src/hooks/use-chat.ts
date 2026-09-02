import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  acknowledgeMessages,
  fetchConversations,
  fetchMessages,
  insertAttachmentRecord,
  insertMessage,
  markConversationRead,
  setBookmark,
  toggleReaction,
} from "@/services/chat/chat-service";
import { uploadToBucket } from "@/services/chat/upload";
import { mediaKindFor, type ChatMessage, type DraftAttachment } from "@/services/chat/types";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export function useConversations(userId: string | null) {
  return useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: () => fetchConversations(userId!),
  });
}

export function useMessages(conversationId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId && !!userId,
    queryFn: () => fetchMessages(conversationId!, userId!),
  });
}

/** Realtime pipe for one conversation: messages, reactions, receipts, typing and presence. */
export function useConversationRealtime(options: {
  conversationId: string | null;
  userId: string | null;
  displayName: string;
  onIncomingMessage?: (senderId: string) => void;
}) {
  const { conversationId, userId, displayName, onIncomingMessage } = options;
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const incomingRef = useRef(onIncomingMessage);
  incomingRef.current = onIncomingMessage;

  useEffect(() => {
    if (!conversationId || !userId) return;
    setConnection("connecting");
    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { sender_id: string };
          if (row.sender_id !== userId) incomingRef.current?.(row.sender_id);
          refresh();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_attachments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] }),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const who = payload as { userId: string; name: string; typing: boolean };
        if (who.userId === userId) return;
        setTypingUsers((prev) =>
          who.typing ? Array.from(new Set([...prev, who.name])) : prev.filter((n) => n !== who.name),
        );
        if (who.typing) {
          window.setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== who.name)), 4000);
        }
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineUsers(Object.keys(channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void channel.track({ userId, name: displayName, at: new Date().toISOString() });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
        } else if (status === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setTypingUsers([]);
    };
  }, [conversationId, userId, displayName, queryClient]);

  const broadcastTyping = useCallback(
    (typing: boolean) => {
      if (!channelRef.current || !userId) return;
      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, name: displayName, typing },
      });
    },
    [userId, displayName],
  );

  return { connection, typingUsers, onlineUsers, broadcastTyping };
}

export interface PendingMessage extends ChatMessage {
  optimistic: { state: "pending" | "failed"; error?: string | undefined };
  draftFiles?: DraftAttachment[] | undefined;
}

/** Send pipeline with pending / failed / retry state and real attachment uploads. */
export function useSendMessage(conversationId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [uploads, setUploads] = useState<DraftAttachment[]>([]);
  const cancels = useRef(new Map<string, () => void>());

  const reset = useCallback(() => {
    setUploads([]);
    cancels.current.clear();
  }, []);

  useEffect(() => {
    setPending([]);
    reset();
  }, [conversationId, reset]);

  const queueFiles = useCallback((files: File[]) => {
    setUploads((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        state: "queued" as const,
        mediaKind: mediaKindFor(file.type, file.name),
      })),
    ]);
  }, []);

  const cancelUpload = useCallback((id: string) => {
    cancels.current.get(id)?.();
    cancels.current.delete(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const send = useCallback(
    async (input: { body: string; parentId?: string | null | undefined; mentions?: string[] | undefined; files?: DraftAttachment[] | undefined }) => {
      if (!conversationId || !userId) return;
      const files = input.files ?? uploads;
      const clientRef = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: PendingMessage = {
        id: clientRef,
        conversation_id: conversationId,
        sender_id: userId,
        parent_id: input.parentId ?? null,
        kind: files.length > 0 ? "attachment" : "text",
        body: input.body,
        client_ref: clientRef,
        created_at: new Date().toISOString(),
        attachments: [],
        reactions: [],
        receipts: [],
        mentions: input.mentions ?? [],
        bookmarked: false,
        pinned: false,
        replyCount: 0,
        optimistic: { state: "pending" },
        draftFiles: files,
      };
      setPending((prev) => [...prev, optimistic]);
      setUploads([]);

      try {
        const message = await insertMessage({
          conversationId,
          senderId: userId,
          body: input.body,
          parentId: input.parentId ?? null,
          kind: optimistic.kind,
          clientRef,
          mentions: input.mentions,
        });

        for (const draft of files) {
          const path = `${conversationId}/${message.id}/${crypto.randomUUID()}-${draft.file.name.replace(/[^\w.\-]+/g, "_")}`;
          setUploads((prev) => prev.map((u) => (u.id === draft.id ? { ...u, state: "uploading" } : u)));
          const handle = uploadToBucket({
            bucket: "chat-files",
            path,
            file: draft.file,
            onProgress: (progress) =>
              setPending((prev) =>
                prev.map((p) =>
                  p.id === clientRef
                    ? {
                        ...p,
                        draftFiles: p.draftFiles?.map((d) =>
                          d.id === draft.id ? { ...d, progress, state: "uploading" } : d,
                        ),
                      }
                    : p,
                ),
              ),
          });
          cancels.current.set(draft.id, handle.cancel);
          await handle.promise;
          cancels.current.delete(draft.id);
          await insertAttachmentRecord({
            messageId: message.id,
            conversationId,
            storagePath: path,
            fileName: draft.file.name,
            mimeType: draft.file.type || "application/octet-stream",
            sizeBytes: draft.file.size,
            mediaKind: draft.mediaKind,
          });
        }

        setPending((prev) => prev.filter((p) => p.id !== clientRef));
        await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        return message.id;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Message could not be sent";
        setPending((prev) =>
          prev.map((p) => (p.id === clientRef ? { ...p, optimistic: { state: "failed", error: messageText } } : p)),
        );
        throw error;
      }
    },
    [conversationId, userId, uploads, queryClient],
  );

  const retry = useCallback(
    async (clientRef: string) => {
      const failed = pending.find((p) => p.id === clientRef);
      if (!failed) return;
      setPending((prev) => prev.filter((p) => p.id !== clientRef));
      await send({
        body: failed.body,
        parentId: failed.parent_id,
        mentions: failed.mentions,
        files: failed.draftFiles?.filter((f) => f.state !== "done"),
      });
    },
    [pending, send],
  );

  const discard = useCallback((clientRef: string) => {
    setPending((prev) => prev.filter((p) => p.id !== clientRef));
  }, []);

  return { pending, uploads, queueFiles, cancelUpload, send, retry, discard };
}

/** Marks visible messages delivered + read against the real receipt table. */
export function useReadReceipts(conversationId: string | null, userId: string | null, messages: ChatMessage[]) {
  const queryClient = useQueryClient();
  const acknowledged = useRef(new Set<string>());

  useEffect(() => {
    acknowledged.current.clear();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !userId || messages.length === 0) return;
    const unseen = messages
      .filter((m) => !m.optimistic && m.sender_id !== userId && !acknowledged.current.has(m.id))
      .map((m) => m.id);
    if (unseen.length === 0) return;
    unseen.forEach((id) => acknowledged.current.add(id));
    void (async () => {
      try {
        await acknowledgeMessages(unseen, userId, true);
        await markConversationRead(conversationId, userId);
        await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      } catch {
        unseen.forEach((id) => acknowledged.current.delete(id));
      }
    })();
  }, [conversationId, userId, messages, queryClient]);
}

export function useMessageActions(conversationId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
    [queryClient, conversationId],
  );

  return useMemo(
    () => ({
      react: async (messageId: string, emoji: string, active: boolean) => {
        if (!userId) return;
        await toggleReaction(messageId, userId, emoji, active);
        await invalidate();
      },
      bookmark: async (messageId: string, pinned: boolean, active: boolean) => {
        if (!userId) return;
        await setBookmark(messageId, userId, pinned, active);
        await invalidate();
      },
    }),
    [userId, invalidate],
  );
}
