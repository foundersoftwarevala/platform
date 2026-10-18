// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handleApi } from "./api.server.ts";
import { audit } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { closeDb } from "./db.server.ts";
import { decideApproval, requestRollback } from "./governance.server.ts";
import {
  approveRequirement,
  createProject,
  raiseChangeRequest,
  saveDraft,
} from "./projects.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-identity-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";

const owner: Operator = { id: "u-owner", email: "owner@test.local", name: "owner", role: "owner" };
const operator: Operator = { id: "u-op", email: "op@test.local", name: "op", role: "operator" };
const viewer: Operator = { id: "u-view", email: "view@test.local", name: "view", role: "viewer" };
const who: Record<string, Operator> = { owner, operator, viewer };
const resolve = async (req: Request) => who[req.headers.get("x-test-caller") ?? ""] ?? null;
const get = async (as: string, path: string) => {
  const res = await handleApi(
    new Request(`http://localhost/api/vala-ai${path}`, { headers: { "x-test-caller": as } }),
    resolve,
  );
  return { status: res.status, body: await res.json() };
};

beforeAll(async () => {
  // Each account is recorded in the people table the first time it calls the API.
  for (const as of ["owner", "operator", "viewer"]) await get(as, "/session");
  const { project, workspace } = createProject({ name: "Identity", sourceKind: "empty" }, owner);
  const d = saveDraft(
    project.id,
    { title: "t", body: "b", checks: [{ label: "c", command: "node --test" }] },
    owner,
  );
  approveRequirement(d.id, owner);
  raiseChangeRequest(
    project.id,
    { reason: "scope", title: "t", body: "b2", checks: [{ label: "c", command: "node --test" }] },
    "agent:T-ABCDEF12",
  );
  const ap = requestRollback(project.id, workspace!.base_commit!, "check labels", operator);
  decideApproval(ap.id, { approve: false, note: "no" }, owner);
  audit("u-ghost", "test.unknown_actor", null, null);
});

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("who did what", () => {
  for (const as of ["owner", "operator"]) {
    it(`${as}s see emails`, async () => {
      const [a] = (await get(as, "/approvals")).body;
      expect(a.requested_by).toBe("u-op");
      expect(a.requested_by_label).toBe("op@test.local");
      expect(a.decided_by_label).toBe("owner@test.local");
      const audit = (await get(as, "/audit")).body.entries;
      expect(
        audit.find((e: { action: string }) => e.action === "approval.request").actor_label,
      ).toBe("op@test.local");
    });
  }

  it("viewers keep seeing account ids only", async () => {
    const [a] = (await get("viewer", "/approvals")).body;
    expect(a.requested_by_label).toBe("u-op");
    expect(a.decided_by_label).toBe("u-owner");
    const text = JSON.stringify((await get("viewer", "/audit")).body);
    expect(text).not.toContain("op@test.local");
    expect(text).not.toContain("owner@test.local");
  });

  it("names the agent and leaves unknown accounts as they are", async () => {
    const [cr] = (await get("owner", "/change-requests")).body;
    expect(cr.raised_by_label).toBe("Vala AI agent (T-ABCDEF12)");
    expect(cr.decided_by_label).toBeNull();
    const ghost = (await get("owner", "/audit")).body.entries.find(
      (e: { action: string }) => e.action === "test.unknown_actor",
    );
    expect(ghost.actor_label).toBe("u-ghost");
  });

  it("refuses callers without a session", async () => {
    expect((await get("nobody", "/approvals")).status).toBe(401);
  });
});
