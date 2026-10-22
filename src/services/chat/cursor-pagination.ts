import type { ChatMessage, ChatMessagePage } from "./types";

/**
 * SQL returns the indexed descending slice as an ascending JSON array with one
 * look-ahead row. Drop that oldest look-ahead row and use the new first row as
 * the next keyset cursor.
 */
export function buildChatMessagePage(
  lookaheadRows: ChatMessage[],
  pageSize: number,
): ChatMessagePage {
  const hasMore = lookaheadRows.length > pageSize;
  const messages = hasMore ? lookaheadRows.slice(1) : lookaheadRows;
  const oldest = messages[0];
  return {
    messages,
    nextCursor:
      hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}
