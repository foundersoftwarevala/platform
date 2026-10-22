import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./types";
import { buildChatMessagePage } from "./cursor-pagination";

function row(id: string): ChatMessage {
  return {
    id,
    conversation_id: "conversation",
    sender_id: "sender",
    parent_id: null,
    kind: "text",
    body: id,
    client_ref: null,
    created_at: "2026-10-21T00:00:00.000Z",
    attachments: [],
    reactions: [],
    receipts: [],
    mentions: [],
    bookmarked: false,
    pinned: false,
    replyCount: 0,
  };
}

describe("chat cursor pages", () => {
  it("drops the look-ahead row and returns a cursor for the next older page", () => {
    const page = buildChatMessagePage([row("oldest-extra"), row("one"), row("two")], 2);

    expect(page.messages.map((message) => message.id)).toEqual(["one", "two"]);
    expect(page.nextCursor).toEqual({
      createdAt: "2026-10-21T00:00:00.000Z",
      id: "one",
    });
  });

  it("returns no cursor when the result fits in one page", () => {
    const page = buildChatMessagePage([row("one")], 2);

    expect(page.messages.map((message) => message.id)).toEqual(["one"]);
    expect(page.nextCursor).toBeNull();
  });
});
