import { describe, expect, it, vi } from "vitest";
import {
  assertVpsDatabaseUrl,
  BATCH_DELAY_MS,
  BATCH_TWO_AGENT_KEYS,
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

  it("limits execution to the 15 reviewed contracts and spaces runs by five seconds", () => {
    expect(Object.keys(TASK_CONTRACTS)).toEqual([
      "demo-scanner",
      "sales-lead-followup",
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
    expect(
      BATCH_TWO_AGENT_KEYS.every(
        (key) =>
          TASK_CONTRACTS[key]?.startsWith("Read-only") ||
          key === "mon-homepage" ||
          key === "mon-website",
      ),
    ).toBe(true);
    expect(BATCH_DELAY_MS).toBe(5_000);
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
