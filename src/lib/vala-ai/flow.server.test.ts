// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyAuditChain } from "./audit.server.ts";
import { all, closeDb, one } from "./db.server.ts";
import {
  FLOW_STEPS,
  advanceFlow,
  createVersion,
  deliverVersion,
  listFlow,
  listIssues,
  reportIssue,
} from "./flow.server.ts";
import { createProject } from "./projects.server.ts";
import type { Operator } from "./auth.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-flow-"));
const op: Operator = { id: "op-1", email: "op@vala.local", name: "Op", role: "operator" };

beforeAll(() => {
  process.env.VALA_AI_DATA_DIR = root;
  closeDb();
});
afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("client workflow (30-step flow, SV codes, release gate)", () => {
  it("defines exactly 30 steps", () => {
    expect(FLOW_STEPS).toHaveLength(30);
  });

  it("issues a SV-PROJECT code on creation", () => {
    const p = createProject({ name: "Rangrez Store", sourceKind: "empty" }, op).project;
    const row = one<{ project_code: string }>("select project_code from projects where id = ?", p.id);
    expect(row!.project_code).toMatch(/^SV-PROJECT-[0-9A-F]{8}$/);
  });

  it("advances the flow and audits it", () => {
    const p = createProject({ name: "Green Valley School", sourceKind: "empty" }, op).project;
    advanceFlow(p.id, 1, op);
    advanceFlow(p.id, 2, op);
    const flow = listFlow().find((f) => f.id === p.id);
    expect(flow!.current_step).toBe(2);
    expect(flow!.steps["1"].status).toBe("completed");
    expect(all("select * from audit_log where action = 'flow.advance'")).toHaveLength(2);
    expect(verifyAuditChain().ok).toBe(true);
  });

  it("rejects steps outside 1..30", () => {
    const p = createProject({ name: "Bad Step", sourceKind: "empty" }, op).project;
    expect(() => advanceFlow(p.id, 31, op)).toThrowError(/between 1 and 30/);
  });

  it("creates versions with SV-VERSION codes and blocks delivery until tests pass", () => {
    const p = createProject({ name: "Clinic App", sourceKind: "empty" }, op).project;
    const v = createVersion(p.id, { changeHistory: "first build" }, op);
    expect(v.version_code).toMatch(/^SV-VERSION-[0-9A-F]{8}$/);
    expect(v.test_status).toBe("not_tested");
    expect(() => deliverVersion(v.id, op)).toThrowError(/test status/);
    const still = one<{ delivery_status: string }>("select delivery_status from versions where id = ?", v.id);
    expect(still!.delivery_status).toBe("not_delivered");
  });

  it("creates issues with SV-ISSUE codes", () => {
    const p = createProject({ name: "Hotel Site", sourceKind: "empty" }, op).project;
    const issue = reportIssue(p.id, { kind: "bug", text: "checkout button broken" }, op);
    expect(issue.issue_code).toMatch(/^SV-ISSUE-[0-9A-F]{8}$/);
    expect(listIssues(p.id)).toHaveLength(1);
  });
});
