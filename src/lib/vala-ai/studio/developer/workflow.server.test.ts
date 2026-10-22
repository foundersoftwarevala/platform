// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "../../db.server";
import { handleApi } from "../../api.server";
import { studioStore } from "../store.server";
import * as workflow from "./developer.server";

const owner = {
  id: "test-owner",
  email: "owner@example.invalid",
  name: "Owner",
  role: "boss" as const,
};
vi.mock("../auth.functions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth.functions")>()),
  requireStudioRole: async () => owner,
}));
vi.mock("../ai/agent.server", () => ({
  structured: async (
    schema: { parse: (v: unknown) => unknown },
    _instructions: string,
    prompt: string,
  ) => ({
    out: schema.parse(
      prompt.startsWith("CLIENT REQUIREMENT")
        ? { passed: true, summary: "Review only", issues: [] }
        : {
            summary: "Inventory",
            category: "inventory",
            modules: ["stock"],
            features: ["inventory"],
            technology: ["typescript"],
            database: null,
            branding: { name: null, colors: [], notes: null },
            keywords: ["stock"],
            business_type: "Store",
            optional_features: [],
            deployment: [],
            missing_info: [],
          },
    ),
  }),
}));
const root = mkdtempSync(join(tmpdir(), "vala-studio-workflow-"));
const previous = process.env.VALA_AI_DATA_DIR;
const previousWorker = process.env.VALA_AI_WORKER;
beforeEach(() => {
  closeDb();
  process.env.VALA_AI_DATA_DIR = join(root, crypto.randomUUID());
  process.env.VALA_AI_WORKER = "off";
});
afterAll(() => {
  closeDb();
  if (previous === undefined) delete process.env.VALA_AI_DATA_DIR;
  else process.env.VALA_AI_DATA_DIR = previous;
  if (previousWorker === undefined) delete process.env.VALA_AI_WORKER;
  else process.env.VALA_AI_WORKER = previousWorker;
  rmSync(root, { recursive: true, force: true });
});

describe("owned source developer workflow", () => {
  it("exposes authenticated client sync without a public secret endpoint", async () => {
    const request = () =>
      new Request("http://local.test/api/vala-ai/studio/control-panel/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "local-fixture",
          name: "Local client",
          data: { flags: ["local-test"] },
        }),
      });
    const denied = await handleApi(request(), async () => ({ ...owner, role: "viewer" }));
    expect(denied.status).toBe(403);
    const result = await handleApi(request(), async () => owner);
    const reply = await result.json();
    expect(result.status, JSON.stringify(reply)).toBe(200);
    expect(reply).toMatchObject({ ok: true });
    expect((await studioStore(owner).from("dev_clients").select()).data[0]?.data).toEqual({
      flags: ["local-test"],
    });
  });
  it("preserves Control Panel client identifiers and nested metadata on sync", async () => {
    const first = await workflow.upsertClient({
      external_id: "cp:local-fixture",
      name: "Local client",
      data: { address: { country: "Local fixture" }, flags: ["local-test"] },
      source: "control_panel",
    });
    const updated = await workflow.upsertClient({
      external_id: "cp:local-fixture",
      name: "Updated local client",
      data: { address: { country: "Local fixture" }, flags: ["local-test", "updated"] },
      source: "control_panel",
    });
    expect(updated.id).toBe(first.id);
    expect(updated.data).toEqual({
      address: { country: "Local fixture" },
      flags: ["local-test", "updated"],
    });
    expect((await studioStore(owner).from("dev_clients").select()).count).toBe(1);
  });
  it("imports, matches with evidence, brands isolated files and creates a truthful delivery snapshot", async () => {
    await workflow.importLibrary([
      {
        source_key: "one",
        name: "Stock App",
        source_location: "local",
        modules: ["stock"],
        features: ["inventory"],
        technology: ["typescript"],
        capabilities: [],
        metadata: {},
      },
    ]);
    const created = await workflow.createProject({
      name: "Client",
      client_name: "Store",
      requirement: "Inventory with stock tracking",
    });
    await workflow.analyzeRequirement(created.requirement.id);
    const match = await workflow.matchRequirement(created.requirement.id);
    expect(match.matches[0]?.score).toBeGreaterThan(0);
    expect(match.matches[0]?.evidence.length).toBeGreaterThan(0);
    await workflow.selectSource(created.project.id, match.matches[0]!.id);
    await workflow.createWorkspace(created.project.id, [
      { path: "index.html", content: "Stock App" },
    ]);
    await workflow.applyBranding(created.project.id, {
      name: "Client brand",
      primary: "#123456",
      secondary: "#654321",
    });
    expect((await workflow.getWorkspace(created.project.id))?.files[0]?.content).toBe(
      "Client brand",
    );
    await workflow.testWorkspace(created.project.id);
    const delivery = await workflow.deliverProject(created.project.id, "Single client license");
    expect(delivery.version_code).toContain(created.project.project_code);
    const detail = await workflow.projectDetail(created.project.id);
    expect(detail.versions[0]?.test_status).toBe("ai_review_only");
    expect(detail.logs.some((log) => log.action === "workflow.deliver")).toBe(true);
  });
  it("refuses a stale code-review result after workspace changes", async () => {
    const created = await workflow.createProject({
      name: "Client",
      requirement: "Inventory with stock tracking",
    });
    await studioStore(owner)
      .from("dev_workspaces")
      .insert({
        project_id: created.project.id,
        files: [{ path: "index.html", content: "Before" }],
      });
    await workflow.testWorkspace(created.project.id);
    await studioStore(owner)
      .from("dev_workspaces")
      .update({ files: [{ path: "index.html", content: "After" }] })
      .eq("project_id", created.project.id);
    await expect(workflow.deliverProject(created.project.id, "License")).rejects.toThrow(
      /changed after review/,
    );
  });
});
