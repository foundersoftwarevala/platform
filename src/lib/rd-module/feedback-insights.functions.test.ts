import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  filters: [] as unknown[][],
  order: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase/client.server", () => ({
  supabaseAdmin: {
    from: state.from,
  },
}));

import { loadFeedbackForAi } from "./feedback-insights.functions";

beforeEach(() => {
  state.filters.length = 0;
  state.order.mockReset();
  state.limit.mockReset();
  state.select.mockReset();
  state.from.mockReset();
  const query = {
    select: state.select.mockReturnThis(),
    eq: (...args: unknown[]) => {
      state.filters.push(args);
      return query;
    },
    order: state.order.mockReturnThis(),
    limit: state.limit,
  };
  state.from.mockReturnValue(query);
  state.select.mockReturnValue(query);
  state.order.mockReturnValue(query);
  state.limit.mockResolvedValue({
    data: [{ member: "Caller", area: "tools", content: "My feedback" }],
    error: null,
  });
});

describe("R&D feedback AI data isolation", () => {
  it("scopes the feedback query to the authenticated caller", async () => {
    const rows = await loadFeedbackForAi("caller-auth-uid");

    expect(state.from).toHaveBeenCalledWith("rnd_team_feedback");
    expect(state.filters).toContainEqual(["submitted_by", "caller-auth-uid"]);
    expect(rows).toEqual([{ member: "Caller", area: "tools", content: "My feedback" }]);
  });

  it("does not continue with AI analysis if the scoped read fails", async () => {
    state.limit.mockResolvedValue({ data: null, error: { message: "read denied" } });

    await expect(loadFeedbackForAi("caller-auth-uid")).rejects.toThrow(
      "Could not load your feedback",
    );
  });
});
