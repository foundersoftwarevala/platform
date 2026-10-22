import { describe, expect, it } from "vitest";
import { calculateLevelTransition } from "./core.server";

describe("calculateLevelTransition", () => {
  it("reports the new level when an XP award crosses a configured threshold", () => {
    const result = calculateLevelTransition(90, 20, [
      { level_number: 1, xp_required: 0 },
      { level_number: 2, xp_required: 50 },
      { level_number: 3, xp_required: 100 },
    ]);

    expect(result).toEqual({
      totalXp: 110,
      previousLevel: 2,
      currentLevel: 3,
      leveledUp: true,
    });
  });
});
