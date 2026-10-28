import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createBridge, executeAction } from "./bridge.js";

let workspace;
let outside;
let bridge;
const pairingToken = "local-test-token-with-at-least-32-bytes";
test.before(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), "ayra-agent-workspace-"));
  outside = await mkdtemp(path.join(os.tmpdir(), "ayra-agent-outside-"));
  await mkdir(path.join(workspace, "src"));
  await writeFile(path.join(workspace, "src", "sample.ts"), "export const value = 7;\n");
  await writeFile(path.join(workspace, ".env"), "SECRET=not-for-reading\n");
  await writeFile(path.join(outside, "outside.ts"), "outside\n");
  await symlink(path.join(outside, "outside.ts"), path.join(workspace, "src", "outside-link.ts"));
  bridge = await createBridge({ workspace, token: pairingToken, port: 0 });
});
test.after(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
  for (const client of bridge.sockets.clients) client.terminate();
  await new Promise((resolve) => bridge.sockets.close(resolve));
  await new Promise((resolve) => bridge.http.close(resolve));
});

test("reads a selected source file inside the configured workspace", async () => {
  assert.deepEqual(await executeAction("read_file", { path: "src/sample.ts" }, workspace), {
    path: path.join("src", "sample.ts"), content: "export const value = 7;\n",
  });
});

test("blocks credential files and traversal outside the workspace", async () => {
  await assert.rejects(executeAction("read_file", { path: ".env" }, workspace), /secret and credential/);
  await assert.rejects(executeAction("read_file", { path: "../../outside.ts" }, workspace), /outside the configured workspace/);
  await assert.rejects(executeAction("read_file", { path: "src/outside-link.ts" }, workspace), /outside the configured workspace/);
  await assert.rejects(executeAction("open_vscode", { path: "src/outside-link.ts" }, workspace), /outside the configured workspace/);
});

test("refuses arbitrary commands and unsupported actions", async () => {
  await assert.rejects(executeAction("run_command", { command: "rm -rf /" }, workspace), /Only the read-only/);
  await assert.rejects(executeAction("shell", { command: "id" }, workspace), /Unsupported/);
});


test("pairs through the exact allowed browser origin and serves a confined action", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/bridge`, "ayra-local-v1", {
    origin: "https://softwarevala.net",
  });
  const nextMessage = () => new Promise((resolve, reject) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
    ws.once("error", reject);
  });
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const authenticated = nextMessage();
  ws.send(JSON.stringify({ type: "authenticate", token: pairingToken }));
  assert.deepEqual(await authenticated, { type: "authenticated", ok: true });

  const response = nextMessage();
  ws.send(JSON.stringify({ type: "request", id: "read-sample", action: "read_file", params: { path: "src/sample.ts" } }));
  assert.deepEqual(await response, {
    type: "response",
    id: "read-sample",
    ok: true,
    result: { path: path.join("src", "sample.ts"), content: "export const value = 7;\n" },
  });
  ws.close();
});


test("rejects WebSocket origins outside the explicit allowlist", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/bridge`, "ayra-local-v1", {
    origin: "https://attacker.example",
  });
  ws.on("error", () => {});
  const status = await new Promise((resolve) => {
    ws.once("unexpected-response", (_request, response) => {
      response.resume();
      resolve(response.statusCode);
    });
  });
  assert.equal(status, 403);
});
