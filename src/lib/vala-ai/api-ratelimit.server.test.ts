// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { handleApi } from "./api.server.ts";
import type { Operator } from "./auth.server.ts";
import { closeDb } from "./db.server.ts";
import { updateSettings } from "./settings.server.ts";

/*
 * Rate limits on the two compute-spending requests, through the real API
 * dispatcher. The requests here are deliberately invalid (empty chat text, an
 * unknown project) so that no model is called: invalid requests count toward
 * the limit by design, which is what makes a flood of them cheap to refuse.
 */

const root = mkdtempSync(join(tmpdir(), "vala-rate-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
process.env.VALA_AI_WORKER = "off";

const alice: Operator = {
  id: "u-alice",
  email: "alice@test.local",
  name: "alice",
  role: "operator",
};
const bob: Operator = { id: "u-bob", email: "bob@test.local", name: "bob", role: "operator" };
const vera: Operator = { id: "u-vera", email: "vera@test.local", name: "vera", role: "viewer" };
const owner: Operator = { id: "u-owner", email: "owner@test.local", name: "owner", role: "owner" };
const callers: Record<string, Operator> = { alice, bob, vera, owner };
const resolve = async (req: Request) => callers[req.headers.get("x-test-caller") ?? ""] ?? null;
const post = (who: string, path: string, body: unknown) =>
  handleApi(
    new Request(`http://localhost/api/vala-ai${path}`, {
      method: "POST",
      headers: { "x-test-caller": who },
      body: JSON.stringify(body),
    }),
    resolve,
  );

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  updateSettings({ chat_per_minute: 3, tasks_per_minute: 2 }, owner.id);
});

afterAll(() => {
  vi.useRealTimers();
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("per-caller rate limits", () => {
  it("lets requests through up to the limit, then answers 429 with Retry-After", async () => {
    for (let i = 0; i < 3; i++)
      expect((await post("alice", "/chat", { text: "" })).status).toBe(400);
    const limited = await post("alice", "/chat", { text: "" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect((await limited.json()).error).toMatch(/limit is 3 per minute/);
  });

  it("keeps each caller's count separate", async () => {
    expect((await post("bob", "/chat", { text: "" })).status).toBe(400);
  });

  it("limits task creation separately from chat", async () => {
    expect(
      (await post("alice", "/projects/VP-NOPE/tasks", { title: "t", instruction: "i" })).status,
    ).toBe(404);
    expect(
      (await post("alice", "/projects/VP-NOPE/tasks", { title: "t", instruction: "i" })).status,
    ).toBe(404);
    expect(
      (await post("alice", "/projects/VP-NOPE/tasks", { title: "t", instruction: "i" })).status,
    ).toBe(429);
  });

  it("does not count requests refused by role", async () => {
    for (let i = 0; i < 5; i++)
      expect((await post("vera", "/chat", { text: "" })).status).toBe(403);
  });

  it("does not limit other writes", async () => {
    for (let i = 0; i < 5; i++)
      expect((await post("alice", "/projects", { sourceKind: "empty" })).status).toBe(400);
  });

  it("resets after the window", async () => {
    vi.setSystemTime(new Date("2026-10-09T12:01:01Z"));
    expect((await post("alice", "/chat", { text: "" })).status).toBe(400);
    expect(
      (await post("alice", "/projects/VP-NOPE/tasks", { title: "t", instruction: "i" })).status,
    ).toBe(404);
  });

  it("rejects limit settings outside their bounds", () => {
    expect(() => updateSettings({ chat_per_minute: 0 }, owner.id)).toThrow(/between 1 and 600/);
    expect(() => updateSettings({ tasks_per_minute: 601 }, owner.id)).toThrow(/between 1 and 600/);
  });
});
