import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeMessages,
  fetchConversations,
  fetchMessages,
  insertAttachmentRecord,
  insertMessage,
  markConversationRead,
  prepareUpload,
  setBookmark,
  toggleReaction,
} from "@/services/chat/chat-service";
import { uploadToSignedPath } from "@/services/chat/upload";
import { subscribeNotificationStream } from "@/lib/realtime/notification-stream";
import {
  CHAT_CONVERSATION_FALLBACK_POLL_MS,
  CHAT_MESSAGE_FALLBACK_POLL_MS,
  chatFallbackRefetchInterval,
  type ChatConnectionState,
} from "@/services/chat/connection-policy";
import {
  mediaKindFor,
  type ChatMessage,
  type ChatMessageCursor,
  type DraftAttachment,
} from "@/services/chat/types";

export type ConnectionState = ChatConnectionState;

export function useConversations(
  userId: string | null,
  enabled = true,
  connection: ConnectionState = "connecting",
) {
  const queryClient = useQueryClient();
  // The conversation list follows chat changes live. They arrive on the
  // platform's notification stream: the /realtime socket below goes to the
  // hosted project, which never sees this database's writes, so its
  // postgres_changes never fire here.
  useEffect(() => {
    if (!userId) return;
    return subscribeNotificationStream((e) => {
      if (e.type === "open" || (e.type === "notification" && e.event?.startsWith("chat."))) {
        void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      }
    });
  }, [userId, queryClient]);
  return useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId && enabled,
    queryFn: () => fetchConversations(userId!),
    refetchInterval: chatFallbackRefetchInterval(
      !!userId && enabled,
      connection,
      CHAT_CONVERSATION_FALLBACK_POLL_MS,
    ),
    refetchIntervalInBackground: false,
  });
}

export const MESSAGE_PAGE = 50;

export function useMessages(
  conversationId: string | null,
  userId: string | null,
  enabled = true,
  connection: ConnectionState = "connecting",
) {
  return useInfiniteQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId && !!userId && enabled,
    initialPageParam: null as ChatMessageCursor | null,
    queryFn: ({ pageParam }) => fetchMessages(conversationId!, userId!, pageParam, MESSAGE_PAGE),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: chatFallbackRefetchInterval(
      !!conversationId && !!userId && enabled,
      connection,
      CHAT_MESSAGE_FALLBACK_POLL_MS,
    ),
    refetchIntervalInBackground: false,
  });
}

/** Authenticated realtime pipe for messages in one authorized conversation. */
export function useConversationRealtime(options: {
  conversationId: string | null;
  userId: string | null;
  onIncomingMessage?: (senderId: string) => void;
}) {
  const { conversationId, userId, onIncomingMessage } = options;
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const conversationRef = useRef(conversationId);
  conversationRef.current = conversationId;
  const incomingRef = useRef(onIncomingMessage);
  incomingRef.current = onIncomingMessage;

  useEffect(() => {
    if (!userId) {
      setConnection("offline");
      return;
    }
    setConnection("connecting");

    const refresh = () => {
      const currentConversationId = conversationRef.current;
      if (currentConversationId) {
        void queryClient.invalidateQueries({ queryKey: ["messages", currentConversationId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    };

    // Chat data lives in the VPS database, not the hosted Realtime database.
    // Its authenticated notification stream is the source for live messages.
    // Do not join public hosted-project channels for private conversation IDs.
    const unsubscribe = subscribeNotificationStream((e) => {
      if (e.type === "open") {
        setConnection("live");
        refresh();
        return;
      }
      if (e.type === "reconnecting") {
        setConnection("reconnecting");
        return;
      }
      if (e.type === "unavailable") {
        setConnection("offline");
        return;
      }
      if (
        e.type !== "notification" ||
        !e.event?.startsWith("chat.")
      )
        return;
      const currentConversationId = conversationRef.current;
      if (currentConversationId && e.conversation_id === currentConversationId) {
        if (e.event === "chat.message" && e.sender_id && e.sender_id !== userId) {
          incomingRef.current?.(e.sender_id);
        }
        void queryClient.invalidateQueries({ queryKey: ["messages", currentConversationId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    });

    return unsubscribe;
  }, [userId, queryClient]);

  return { connection };
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
    async (input: {
      body: string;
      parentId?: string | null | undefined;
      mentions?: string[] | undefined;
      files?: DraftAttachment[] | undefined;
    }) => {
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
          // The server authorizes the file against the conversation and signs
          // a one-time slot in the chat bucket for it.
          const slot = await prepareUpload({
            conversationId,
            messageId: message.id,
            fileName: draft.file.name,
            mimeType: draft.file.type,
            sizeBytes: draft.file.size,
          });
          const path = slot.path;
          setUploads((prev) =>
            prev.map((u) => (u.id === draft.id ? { ...u, state: "uploading" } : u)),
          );
          const handle = uploadToSignedPath({
            signedPath: slot.signedPath,
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
          prev.map((p) =>
            p.id === clientRef ? { ...p, optimistic: { state: "failed", error: messageText } } : p,
          ),
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
export function useReadReceipts(
  conversationId: string | null,
  userId: string | null,
  messages: ChatMessage[],
) {
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
