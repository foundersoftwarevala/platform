import { describe, expect, it } from "vitest";

import { buildUsageDailySeries, usageWindowStart } from "./ai-api.functions";

const NOW = new Date("2026-10-08T06:30:00.000Z");

describe("usageWindowStart", () => {
  it("starts at midnight UTC of the first day in the window", () => {
    expect(usageWindowStart(NOW, 7).toISOString()).toBe("2026-10-02T00:00:00.000Z");
  });
});

describe("buildUsageDailySeries", () => {
  it("returns one point per day, oldest first, with zeroes for days without events", () => {
    const series = buildUsageDailySeries([], NOW, 7);
    expect(series.map((point) => point.date)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
    expect(series.every((point) => point.requests === 0 && point.cost === 0)).toBe(true);
  });

  it("aggregates persisted rows into their own calendar day", () => {
    const series = buildUsageDailySeries(
      [
        { occurred_at: "2026-10-07T10:00:00Z", requests: 2, cost_usd: 1.5, success: true },
        { occurred_at: "2026-10-07T23:59:59Z", requests: 3, cost_usd: "0.5", success: false },
        { occurred_at: "2026-10-08T00:00:01Z", requests: 1, cost_usd: 0.25, success: true },
      ],
      NOW,
      7,
    );
    const byDate = Object.fromEntries(series.map((point) => [point.date, point]));
    expect(byDate["2026-10-07"]).toEqual({
      date: "2026-10-07",
      requests: 5,
      cost: 2,
      errors: 1,
    });
    expect(byDate["2026-10-08"]).toEqual({
      date: "2026-10-08",
      requests: 1,
      cost: 0.25,
      errors: 0,
    });
  });

  it("never invents traffic from rows outside the window or with unusable values", () => {
    const series = buildUsageDailySeries(
      [
        { occurred_at: "2026-09-01T10:00:00Z", requests: 99, cost_usd: 99 },
        { occurred_at: "not-a-date", requests: 99, cost_usd: 99 },
        { requests: 99, cost_usd: 99 },
        { occurred_at: "2026-10-06T10:00:00Z", requests: "oops", cost_usd: null },
      ],
      NOW,
      7,
    );
    expect(series.reduce((acc, point) => acc + point.requests, 0)).toBe(0);
    expect(series.reduce((acc, point) => acc + point.cost, 0)).toBe(0);
  });
});
