import { describe, expect, it } from "vitest";
import {
  ForecastModelSchema,
  RiskSummaryModelSchema,
  groupSecurityAlerts,
  normalizeForecast,
  validateSecurityGroupScores,
  type ForecastModelOutput,
  type HistoryData,
} from "../insights.server";

const history: HistoryData = {
  weeks: [
    {
      week: "2026-10-12",
      paidOrders: 2,
      revenueByCurrency: { USD: 100 },
      leads: 3,
      supportTickets: 2,
    },
    {
      week: "2026-10-19",
      paidOrders: 1,
      revenueByCurrency: { USD: 50 },
      leads: 1,
      supportTickets: 1,
    },
  ],
  summary: {
    weeks: 2,
    paidOrders: 3,
    leads: 4,
    supportTickets: 3,
    openSupportTickets: 1,
    currencies: ["USD"],
  },
};

function forecast(overrides: Partial<ForecastModelOutput> = {}): ForecastModelOutput {
  return {
    periods: ["7d", "30d", "90d"].map((period) => ({
      period: period as "7d" | "30d" | "90d",
      revenueByCurrency: [{ currency: "USD", amount: 100_000 }],
      leads: 100_000,
      supportTickets: 100_000,
      confidence: 40,
      rationale: "Estimate based on the weekly records.",
    })),
    limitations: "Only a small number of weekly observations are available.",
    ...overrides,
  };
}

describe("operational forecasts are bounded by recorded VPS history", () => {
  it("orders the horizons and caps extreme model outputs to a multiple of observed peaks", () => {
    const result = normalizeForecast(forecast(), history);
    expect(result.map((period) => period.period)).toEqual(["7d", "30d", "90d"]);
    expect(result[0]?.revenueByCurrency[0]?.amount).toBe(1_000);
    expect(result[0]?.leads).toBe(30);
    expect(result[0]?.supportTickets).toBe(20);
    expect(result[1]?.revenueByCurrency[0]?.amount).toBe(5_000);
    expect(result[2]?.supportTickets).toBe(260);
  });

  it("rejects a currency that has no basis in the order records", () => {
    const invalid = forecast({
      periods: forecast().periods.map((period) => ({
        ...period,
        revenueByCurrency: [{ currency: "EUR", amount: 10 }],
      })),
    });
    expect(() => normalizeForecast(invalid, history)).toThrow(/unsupported currency/i);
  });

  it("returns zero revenue when a recorded currency has no positive historical total", () => {
    const noRevenue: HistoryData = {
      ...history,
      weeks: [{ ...history.weeks[0]!, revenueByCurrency: { USD: 0 } }],
    };
    const result = normalizeForecast(forecast(), noRevenue);
    expect(result.every((period) => period.revenueByCurrency[0]?.amount === 0)).toBe(true);
  });
});

describe("security alert scoring batches", () => {
  const alerts = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Unexpected login",
      severity: "high",
      category: "auth",
      source: "scanner",
      detectedAt: "2026-11-08T00:00:00Z",
      description: "Repeated failed login attempts",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: " Unexpected login ",
      severity: "HIGH",
      category: "AUTH",
      source: "Scanner",
      detectedAt: "2026-11-08T01:00:00Z",
      description: "Repeated failed login attempts",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      title: "Unpatched dependency",
      severity: "medium",
      category: "dependencies",
      source: "scanner",
      detectedAt: "2026-11-08T02:00:00Z",
      description: null,
    },
  ];

  it("groups duplicate patterns without losing the alert IDs", () => {
    const groups = groupSecurityAlerts(alerts);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.alerts.length).sort()).toEqual([1, 2]);
    expect(groups.flatMap((group) => group.alerts.map((alert) => alert.id)).sort()).toEqual(
      alerts.map((alert) => alert.id).sort(),
    );
  });

  it("requires exactly one score for every distinct pattern", () => {
    const groups = groupSecurityAlerts(alerts);
    const expected = groups.map((group) => group.id);
    const received = expected.map((id) => ({ id, severity: "MEDIUM" as const, score: 50 }));
    expect(validateSecurityGroupScores(expected, received).size).toBe(2);
    expect(() => validateSecurityGroupScores(expected, received.slice(1))).toThrow(
      /every distinct security alert pattern/i,
    );
    expect(() => validateSecurityGroupScores(expected, [...received, received[0]!])).toThrow(
      /every distinct security alert pattern/i,
    );
  });
});

describe("local model risk summary response normalization", () => {
  it("accepts the model's preventiveSuggestions alias and normalizes severity case", () => {
    const response = RiskSummaryModelSchema.parse({
      summary: "The scored alert patterns identify recurring access risks.",
      preventiveSuggestions: [
        {
          title: "Review access",
          action: "Review exposed access paths and revoke unused credentials.",
          severity: "high",
        },
        {
          title: "Patch dependencies",
          action: "Prioritize the affected dependencies and verify patched versions.",
          severity: "medium",
        },
        {
          title: "Monitor alerts",
          action: "Track repeated alerts and investigate any increase in frequency.",
          severity: "low",
        },
      ],
    });
    expect(response.suggestions.map((suggestion) => suggestion.severity)).toEqual([
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
  });
});

describe("local model forecast response normalization", () => {
  it("normalizes currency maps and numeric strings into the typed forecast contract", () => {
    const response = ForecastModelSchema.parse({
      periods: ["7d", "30d", "90d"].map((period) => ({
        period,
        revenueByCurrency: { USD: "125.5" },
        leads: "12",
        supportTickets: 3,
        confidence: "65",
        rationale: "Estimate based on the recorded weekly activity.",
      })),
      limitations: "Only the available VPS history was used.",
    });
    expect(response.periods[0]?.revenueByCurrency).toEqual([{ currency: "USD", amount: 125.5 }]);
    expect(response.periods[0]?.leads).toBe(12);
    expect(response.periods[0]?.confidence).toBe(65);
  });
});
