// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The AI API Manager source, with the gateway replaced by a test double
 * (vi.mock below). No request leaves this machine in this file; the real
 * provider path is in model-gateway-live.server.test.ts and runs only when
 * explicitly enabled with real credentials.
 */
vi.mock("@/lib/ai-gateway.server", () => ({
  aiComplete: vi.fn(),
  resolveAiTarget: vi.fn(),
  resolveAiTargets: vi.fn(),
}));
import * as gateway from "@/lib/ai-gateway.server";

import { handleApi } from "./api.server.ts";
import type { Operator } from "./auth.server.ts";
import { closeDb } from "./db.server.ts";
import {
  chat,
  chatJson,
  classifyGatewayError,
  gatewayServices,
  ModelUnavailableError,
  modelStatus,
} from "./model.server.ts";
import { approveRequirement, createProject, saveDraft } from "./projects.server.ts";
import { updateSettings } from "./settings.server.ts";
import { createTask, getTask, taskEvents, verificationOf } from "./tasks.server.ts";
import { runStepSafely } from "./worker.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-gateway-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";
const owner: Operator = { id: "u-owner", email: "o@test.local", name: "o", role: "owner" };
const operator: Operator = { id: "u-op", email: "op@test.local", name: "op", role: "operator" };
const aiComplete = vi.mocked(gateway.aiComplete);
const resolveAiTarget = vi.mocked(gateway.resolveAiTarget);
const resolveAiTargets = vi.mocked(gateway.resolveAiTargets);
const SCHEMA = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };

beforeAll(() => {
  updateSettings(
    {
      model_source: "ai-api-manager",
      gateway_service: "svc-openai-1",
      min_free_mem_mb: 256,
      min_free_disk_gb: 1,
    },
    owner.id,
  );
});
beforeEach(() => {
  aiComplete.mockReset();
  resolveAiTarget.mockReset();
  resolveAiTargets.mockReset();
});
afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("settings", () => {
  it("accepts only the two sources and an AI API Manager service id", () => {
    expect(() => updateSettings({ model_source: "openai-direct" }, owner.id)).toThrow(
      /"local" or "ai-api-manager"/,
    );
    expect(() =>
      updateSettings({ gateway_service: "https://api.openai.com/v1" }, owner.id),
    ).toThrow(/service id/);
    expect(() => updateSettings({ gateway_service: "sk-live/abc" }, owner.id)).toThrow(
      /service id/,
    );
    expect(() => updateSettings({ model_url: "https://api.openai.com" }, owner.id)).toThrow(
      /self-hosted/,
    );
  });
});

describe("requests through the gateway", () => {
  it("calls aiComplete as module vala-ai, with the chosen service and the schema stated", async () => {
    aiComplete.mockResolvedValue({
      text: '{"a":"x"}',
      model: "gpt-4o-mini",
      service: "OpenAI chat",
    });
    const { value, reply } = await chatJson<{ a: string }>(
      [
        { role: "system", content: "sys" },
        { role: "user", content: "u" },
      ],
      SCHEMA,
    );
    expect(value.a).toBe("x");
    const call = aiComplete.mock.calls[0][0];
    expect(call).toMatchObject({ module: "vala-ai", json: true, serviceId: "svc-openai-1" });
    expect(call.messages[0].content).toContain('"required":["a"]');
    expect(reply).toMatchObject({
      source: "ai-api-manager",
      service: "OpenAI chat",
      model: "gpt-4o-mini",
      tokensIn: null,
      tokensOut: null,
    });
  });

  it("accepts a JSON reply wrapped in a code fence and rejects malformed or incomplete JSON", async () => {
    aiComplete.mockResolvedValueOnce({ text: '```json\n{"a":"y"}\n```', model: "m", service: "s" });
    expect((await chatJson<{ a: string }>([{ role: "user", content: "u" }], SCHEMA)).value.a).toBe(
      "y",
    );
    aiComplete.mockResolvedValueOnce({ text: "Sure! Here it is", model: "m", service: "s" });
    await expect(chatJson([{ role: "user", content: "u" }], SCHEMA)).rejects.toThrow(
      /AI API Manager returned malformed JSON/,
    );
    aiComplete.mockResolvedValueOnce({ text: '{"b":1}', model: "m", service: "s" });
    await expect(chatJson([{ role: "user", content: "u" }], SCHEMA)).rejects.toThrow(
      /missing required fields/,
    );
  });

  it("sorts gateway failures into wait (BLOCKED) or fail", () => {
    expect(
      classifyGatewayError(
        "No active AI service is configured in AI API Manager. Add one to enable AI features.",
      ),
    ).toBeInstanceOf(ModelUnavailableError);
    expect(classifyGatewayError("OpenAI chat: 401 Incorrect API key provided")).toBeInstanceOf(
      ModelUnavailableError,
    );
    expect(
      classifyGatewayError("OpenAI chat: 429 Rate limit reached for gpt-4o-mini"),
    ).toBeInstanceOf(ModelUnavailableError);
    expect(classifyGatewayError("OpenAI chat: insufficient_quota")).toBeInstanceOf(
      ModelUnavailableError,
    );
    const fault = classifyGatewayError("OpenAI chat: 500 The server had an error");
    expect(fault).not.toBeInstanceOf(ModelUnavailableError);
    expect(fault.status).toBe(502);
  });

  it("gives up waiting at the model timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    aiComplete.mockReturnValue(new Promise(() => {}));
    const pending = chat([{ role: "user", content: "u" }]);
    const assertion = expect(pending).rejects.toThrow(/did not answer within 600s/);
    await vi.advanceTimersByTimeAsync(600_000);
    await assertion;
    vi.useRealTimers();
  });

  it("stops waiting when the task is cancelled", async () => {
    aiComplete.mockReturnValue(new Promise(() => {}));
    const ac = new AbortController();
    const pending = chat([{ role: "user", content: "u" }], { signal: ac.signal });
    ac.abort();
    await expect(pending).rejects.toMatchObject({ status: 499 });
  });
});

describe("status and service list", () => {
  it("reports readiness without sending a request to the provider", async () => {
    resolveAiTarget.mockResolvedValue({
      serviceId: "svc-openai-1",
      serviceName: "OpenAI chat",
      modelId: "gpt-4o-mini",
    } as never);
    const s = await modelStatus();
    expect(s).toMatchObject({
      online: true,
      source: "ai-api-manager",
      service: "OpenAI chat",
      model: "gpt-4o-mini",
    });
    expect(aiComplete).not.toHaveBeenCalled();
    resolveAiTarget.mockRejectedValue(
      new Error("No active AI service is configured in AI API Manager."),
    );
    expect(await modelStatus()).toMatchObject({
      online: false,
      error: expect.stringMatching(/No active AI service/),
    });
  });

  it("lists services without their credentials, to owners only", async () => {
    resolveAiTargets.mockResolvedValue([
      {
        serviceId: "svc-openai-1",
        serviceName: "OpenAI chat",
        providerSlug: "openai",
        modelId: "gpt-4o-mini",
        credential: "sk-should-never-leave",
        endpoint: "https://api.openai.com/v1/chat/completions",
      } as never,
    ]);
    expect(await gatewayServices()).toEqual({
      available: true,
      error: null,
      services: [
        { id: "svc-openai-1", name: "OpenAI chat", provider: "openai", model: "gpt-4o-mini" },
      ],
    });
    const as = (op: Operator) =>
      handleApi(new Request("http://localhost/api/vala-ai/gateway-services"), async () => op);
    expect((await as(operator)).status).toBe(403);
    const res = await as(owner);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("sk-should-never-leave");
    expect(text).not.toContain("api.openai.com");
  });
});

describe("a task built through AI API Manager", () => {
  let projectId = "";
  beforeAll(() => {
    const src = join(root, "calc");
    spawnSync("git", ["init", "--quiet", src]);
    writeFileSync(join(src, "math.mjs"), "export function add(a, b) {\n  return 0;\n}\n");
    writeFileSync(
      join(src, "check.mjs"),
      "import { add } from './math.mjs';\nprocess.exit(add(2, 3) === 5 ? 0 : 1);\n",
    );
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"], { cwd: src });
    spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "init"],
      { cwd: src },
    );
    projectId = createProject({ name: "Gateway task", sourceKind: "git", sourcePath: src }, owner)
      .project.id;
    const d = saveDraft(
      projectId,
      {
        title: "add",
        body: "add returns the sum",
        checks: [{ label: "add", command: "node check.mjs" }],
      },
      owner,
    );
    approveRequirement(d.id, owner);
  });

  const drive = async (taskId: string) => {
    for (let i = 0; i < 10; i++) {
      const t = getTask(taskId);
      if (["COMPLETE", "FAILED", "BLOCKED", "CANCELLED"].includes(t.state)) break;
      await runStepSafely(t, "test-runner", new AbortController().signal);
    }
    return getTask(taskId);
  };

  it("completes and is verified, with the gateway's model and service in the evidence", async () => {
    resolveAiTarget.mockResolvedValue({
      serviceId: "svc-openai-1",
      serviceName: "OpenAI chat",
      modelId: "gpt-4o-mini",
    } as never);
    aiComplete.mockImplementation(async (opts) => {
      const isPlan = String(opts.messages[0].content).includes("scope_conflict");
      const text = isPlan
        ? JSON.stringify({
            summary: "fix add",
            files_to_read: ["math.mjs"],
            steps: ["return a + b"],
            scope_conflict: "",
          })
        : JSON.stringify({
            edits: [
              {
                path: "math.mjs",
                action: "write",
                content: "export function add(a, b) {\n  return a + b;\n}\n",
              },
            ],
            notes: "done",
          });
      return { text, model: "gpt-4o-mini", service: "OpenAI chat" };
    });
    const t = await drive(
      createTask(projectId, { title: "fix add", instruction: "make add return the sum" }, owner).id,
    );
    expect(t.state).toBe("COMPLETE");
    expect(verificationOf(t).status).toBe("VERIFIED");
    const modelEvents = taskEvents(t.id).filter((e) => e.kind === "model");
    expect(modelEvents.map((e) => e.message)).toEqual([
      expect.stringMatching(/^Plan: AI API Manager \(OpenAI chat\), model gpt-4o-mini answered/),
      expect.stringMatching(/^Build: AI API Manager \(OpenAI chat\), model gpt-4o-mini answered/),
    ]);
    expect(JSON.parse(modelEvents[0].data_json!)).toMatchObject({
      source: "ai-api-manager",
      service: "OpenAI chat",
      usage: expect.stringMatching(/usage_events/),
    });
  }, 60_000);

  it("waits as BLOCKED, with the reason, when AI API Manager is not ready", async () => {
    resolveAiTarget.mockRejectedValue(
      new Error(
        "No active AI service is configured in AI API Manager. Add one to enable AI features.",
      ),
    );
    const t = await drive(createTask(projectId, { title: "blocked", instruction: "x" }, owner).id);
    expect(t.state).toBe("BLOCKED");
    expect(t.blocked_reason).toMatch(/AI API Manager is not ready: No active AI service/);
    expect(aiComplete).not.toHaveBeenCalled();
  });

  it("waits as BLOCKED when the provider rejects the credentials mid-task", async () => {
    resolveAiTarget.mockResolvedValue({
      serviceId: "svc-openai-1",
      serviceName: "OpenAI chat",
      modelId: "gpt-4o-mini",
    } as never);
    aiComplete.mockRejectedValue(new Error("OpenAI chat: 401 Incorrect API key provided"));
    const t = await drive(createTask(projectId, { title: "bad key", instruction: "x" }, owner).id);
    expect(t.state).toBe("BLOCKED");
    expect(t.blocked_reason).toMatch(/rejected the credentials/);
  });
});
