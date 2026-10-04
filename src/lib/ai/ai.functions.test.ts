import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Vala AI server functions read and write with the service-role key, so
 * each one must check its caller first, and none may name a table that does
 * not exist on the platform database.
 */
const source = readFileSync(resolve(__dirname, "ai.functions.ts"), "utf8");
const store = readFileSync(resolve(__dirname, "vala-ai.server.ts"), "utf8");

describe("Vala AI server functions", () => {
  it("check the caller in every handler", () => {
    const handlers = source.split(".handler(").slice(1);
    expect(handlers.length).toBeGreaterThanOrEqual(11);
    for (const handler of handlers) expect(handler.slice(0, 200)).toMatch(/await operator\(/);
    expect(source).toMatch(/requireOperator/);
  });

  it("show each account only its own commands and keep the lock with operators", () => {
    expect(store).toMatch(/\.eq\("metadata->>user_id", userId\)/);
    expect(source).toMatch(/readPromptHistory\(caller\)/);
    expect(source).toMatch(/readExecutionLogs\(caller\)/);
    expect(source).toMatch(/operator\("Changing the Vala AI lock", \{ operatorsOnly: true \}\)/);
  });

  it("touch none of the tables that were never created", () => {
    for (const table of [
      "ai_projects",
      "ai_logs",
      "ai_credits",
      "ai_credit_transactions",
      "ai_issues",
      "ai_settings",
      "ai_snapshots",
      "ai_lock_state",
      "ai_execution_logs",
    ]) {
      expect(store).not.toMatch(new RegExp(`from\\("${table}"\\)`));
      expect(source).not.toMatch(new RegExp(`from\\("${table}"\\)`));
    }
    expect(store).not.toMatch(/from\("ai_prompts"\)/);
  });
});
