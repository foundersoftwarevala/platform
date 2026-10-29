import { describe, expect, it, vi } from "vitest";
import {
  assertVpsDatabaseUrl,
  BATCH_DELAY_MS,
  BATCH_TWO_AGENT_KEYS,
  BATCH_THREE_AGENT_KEYS,
  BATCH_FOUR_AGENT_KEYS,
  leadScore,
  extractStoredLinks,
  normalizeDraft,
  runBatch,
  TASK_CONTRACTS,
} from "./run-agents.mjs";

describe("VPS agent contract runner", () => {
  it("only accepts a loopback connection to sv_platform", () => {
    expect(assertVpsDatabaseUrl("postgres://worker:secret@127.0.0.1/sv_platform")).toContain(
      "sv_platform",
    );
    expect(() =>
      assertVpsDatabaseUrl("postgres://worker:secret@db.example.test/sv_platform"),
    ).toThrow(/VPS-only/);
    expect(() => assertVpsDatabaseUrl("postgres://worker:secret@127.0.0.1/postgres")).toThrow(
      /VPS-only/,
    );
    expect(() => assertVpsDatabaseUrl("https://example.test/sv_platform")).toThrow(/VPS-only/);
  });

  it("limits execution to reviewed contracts and spaces runs by five seconds", () => {
    expect(Object.keys(TASK_CONTRACTS)).toEqual([
      "demo-scanner",
      "support-reply-drafter",
      "mon-availability",
      "finance-intelligence",
      "mon-homepage",
      "mon-vendor",
      "mon-security",
      "mon-order",
      "mon-payment",
      "mon-website",
      "mon-api",
      "mon-database",
      "mon-error",
      "mon-alerts",
      ...BATCH_THREE_AGENT_KEYS,
      ...BATCH_FOUR_AGENT_KEYS,
    ]);
    expect(BATCH_FOUR_AGENT_KEYS).toEqual([
      "mon-seo",
      "mon-social",
      "mon-content",
      "mon-reputation",
      "mon-complaint",
      "mon-refund",
      "mon-customer",
      "mon-conversion",
      "mon-campaign",
      "mon-competitor",
      "mon-pricing",
      "mon-marketing-monitor",
      "mon-knowledge-monitor",
      "mon-notification",
      "reporting",
    ]);
    expect(BATCH_TWO_AGENT_KEYS).toEqual([
      "mon-homepage",
      "mon-vendor",
      "mon-security",
      "mon-order",
      "mon-payment",
      "mon-website",
      "mon-api",
      "mon-database",
      "mon-error",
      "mon-alerts",
    ]);
    expect(BATCH_THREE_AGENT_KEYS).toEqual([
      "sales-lead-qualification",
      "sales-lead-followup",
      "sales-demo-booking",
      "sales-demo-followup",
      "sales-trial-conversion",
      "sales-subscription-sales",
      "sales-renewal-sales",
      "sales-upsell",
      "sales-cross-sell",
      "sales-enterprise-sales",
      "sales-smb-sales",
      "sales-reseller-sales",
      "sales-marketplace-sales",
      "sales-objection-handling",
      "sales-proposal",
    ]);
    expect(
      BATCH_TWO_AGENT_KEYS.every(
        (key) =>
          TASK_CONTRACTS[key]?.startsWith("Read-only") ||
          key === "mon-homepage" ||
          key === "mon-website",
      ),
    ).toBe(true);
    expect(BATCH_THREE_AGENT_KEYS.every((key) => TASK_CONTRACTS[key])).toBe(true);
    expect(TASK_CONTRACTS["sales-lead-followup"]).toContain("3 days");
    expect(TASK_CONTRACTS["sales-demo-booking"]).toContain("never invent or promise time slots");
    expect(TASK_CONTRACTS["sales-proposal"]).toContain("no PDF generation");
    expect(TASK_CONTRACTS["mon-refund"]).toContain("requires_human_policy_review");
    expect(TASK_CONTRACTS["mon-notification"]).toContain("Do not send test email/SMS");
    expect(TASK_CONTRACTS["mon-competitor"]).toContain("do not simulate observations");
    expect(BATCH_DELAY_MS).toBe(5_000);
  });

  it("scores only recorded lead evidence and marks sparse records insufficient", () => {
    const scored = leadScore({
      budget_range: "USD 5,000-10,000",
      source: "partner referral",
      company: "Example Co",
      cta_action: "request_demo",
    });
    expect(scored.sufficient).toBe(true);
    expect(scored.factors.map(({ factor }) => factor)).toEqual(
      expect.arrayContaining(["budget_recorded", "source_recorded"]),
    );
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(leadScore({}).sufficient).toBe(false);
  });

  it("extracts bounded FAQ and banner links without treating external URLs as same-site", () => {
    expect(
      extractStoredLinks('<a href="/help">Help</a><a href="https://outside.test/a">Outside</a>', 1),
    ).toEqual(["/help"]);
    expect(extractStoredLinks('<a href="javascript:alert(1)">bad</a>', 5)).toEqual([]);
  });

  it("rejects empty or oversized generated drafts", () => {
    expect(normalizeDraft("  Hello there.  ")).toBe("Hello there.");
    expect(() => normalizeDraft(" ")).toThrow(/empty/);
    expect(() => normalizeDraft("x".repeat(4_001))).toThrow(/4000/);
    expect(() => normalizeDraft("<script>alert(1)</script>")).toThrow(/markup/);
  });

  it("fails closed before any task runs when a contract is missing or changed", async () => {
    const query = vi.fn(async () => [
      {
        id: "1",
        agent_key: "demo-scanner",
        status: "active",
        lifecycle: "AVAILABLE",
        task_contract: "unexpected",
      },
    ]);
    const sleep = vi.fn();
    await expect(runBatch(query as never, { sleep, delayMs: 0 })).rejects.toThrow(
      /no work started/,
    );
    expect(query).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
