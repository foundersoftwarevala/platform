// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/*
 * A real request through AI API Manager to the configured provider (OpenAI).
 * It runs only when VALA_AI_LIVE_GATEWAY_TEST=1 is set on a machine that has
 * the platform's database settings, the encryption key and an active AI
 * service — never by default, because it is a paid, external request.
 */
const enabled = process.env.VALA_AI_LIVE_GATEWAY_TEST === "1";
if (!enabled)
  console.warn(
    "[gateway-live] VALA_AI_LIVE_GATEWAY_TEST is not set: the real provider test is skipped.",
  );

describe.skipIf(!enabled)("real request through AI API Manager", () => {
  const root = mkdtempSync(join(tmpdir(), "vala-gateway-live-"));
  process.env.VALA_AI_DATA_DIR = join(root, "data");
  afterAll(async () => {
    (await import("./db.server.ts")).closeDb();
    rmSync(root, { recursive: true, force: true });
  });

  it("gets a schema-valid answer from the configured service", async () => {
    const { updateSettings } = await import("./settings.server.ts");
    const { chatJson, modelStatus } = await import("./model.server.ts");
    updateSettings(
      {
        model_source: "ai-api-manager",
        gateway_service: process.env.VALA_AI_LIVE_GATEWAY_SERVICE ?? "",
      },
      "live-test",
    );
    const status = await modelStatus();
    expect(status.online, status.error ?? "").toBe(true);
    const { value, reply } = await chatJson<{ answer: string }>(
      [
        { role: "system", content: "Reply with JSON only." },
        { role: "user", content: "What is 2 + 3? Put the digit in answer." },
      ],
      { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
      { maxTokens: 50 },
    );
    expect(value.answer).toMatch(/5/);
    expect(reply.source).toBe("ai-api-manager");
    console.log(
      `[gateway-live] service=${reply.service} model=${reply.model} ms=${reply.durationMs}`,
    );
  }, 120_000);
});
