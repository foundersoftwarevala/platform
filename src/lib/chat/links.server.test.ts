import { describe, expect, it, vi } from "vitest";
import type { ChatManagerTransaction } from "./manager-db.server";
import { validateConversationMessage } from "./links.server";

describe("conversation link message validation", () => {
  it("does not query messages for a conversation-level link", async () => {
    const query = vi.fn();
    await validateConversationMessage(
      query as unknown as ChatManagerTransaction,
      "conversation",
      null,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("validates both the message and its conversation with bound parameters", async () => {
    const query = vi.fn().mockResolvedValue([{ id: "message" }]);
    await validateConversationMessage(
      query as unknown as ChatManagerTransaction,
      "conversation",
      "message",
    );
    const [sql, ...parameters] = query.mock.calls[0];
    expect(sql.join("")).toContain("conversation_id = ");
    expect(parameters).toEqual(["message", "conversation"]);
  });

  it("rejects a missing message or one belonging to another conversation", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await expect(
      validateConversationMessage(
        query as unknown as ChatManagerTransaction,
        "conversation",
        "foreign",
      ),
    ).rejects.toThrow("The selected message is not part of this conversation.");
  });

  it("propagates database failures rather than accepting the link", async () => {
    const query = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(
      validateConversationMessage(
        query as unknown as ChatManagerTransaction,
        "conversation",
        "message",
      ),
    ).rejects.toThrow("database unavailable");
  });
});
