import { execFile, spawn } from "node:child_process";
import { createServer } from "node:http";
import { constants as fsConstants } from "node:fs";
import { access, realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";

const PORT = 50001;
const MAX_FILE_BYTES = 64 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".html", ".java", ".js",
  ".jsx", ".md", ".py", ".rs", ".sql", ".toml", ".ts", ".tsx", ".txt",
  ".xml", ".yaml", ".yml",
]);
const BLOCKED_PATH = /(^|[\\/])(?:\.env(?:\.|$)|\.aws(?:$|[\\/])|\.kube(?:$|[\\/])|\.ssh(?:$|[\\/])|[^\\/]*(?:secret|credential|private|id_rsa|id_ed25519)[^\\/]*)(?:[\\/]|$)/i;
const ALLOWED_ORIGINS = new Set([
  "https://softwarevala.net",
  "https://www.softwarevala.net",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const ALLOWED_COMMANDS = new Map([
  ["git_status", ["status", "--short", "--branch"]],
  ["git_recent", ["log", "-5", "--oneline", "--decorate"]],
]);

function equalSecret(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function resolveInsideWorkspace(workspace, requestPath = "") {
  if (typeof requestPath !== "string" || requestPath.length > 240 || path.isAbsolute(requestPath)) {
    throw new Error("Use a relative path inside the configured workspace.");
  }
  const target = path.resolve(workspace, requestPath || ".");
  const relative = path.relative(workspace, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Path is outside the configured workspace.");
  }
  if (BLOCKED_PATH.test(relative)) throw new Error("Access to secret and credential paths is disabled.");
  return target;
}

async function runGit(args, workspace) {
  return new Promise((resolve, reject) => {
    execFile("git", args, {
      cwd: workspace,
      timeout: 8_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim().slice(0, 1000)));
        return;
      }
      resolve(String(stdout).slice(0, 64 * 1024));
    });
  });
}

export async function executeAction(action, params, workspace) {
  if (action === "open_vscode") {
    const target = resolveInsideWorkspace(workspace, params.path ?? "");
    const resolved = await realpath(target);
    const relative = path.relative(workspace, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Resolved path is outside the configured workspace.");
    }
    if (BLOCKED_PATH.test(relative)) throw new Error("Access to secret and credential paths is disabled.");
    const targetInfo = await stat(resolved).catch(() => null);
    if (!targetInfo?.isDirectory() && !targetInfo?.isFile()) throw new Error("Workspace path does not exist.");
    const executable = process.env.AYRA_VSCODE_COMMAND || "code";
    if (executable.includes(path.sep)) {
      await access(executable, fsConstants.X_OK).catch((error) => {
        throw new Error(`VS Code executable is unavailable: ${error.message}`);
      });
    }
    return new Promise((resolve, reject) => {
      const child = spawn(executable, ["--reuse-window", resolved], { cwd: workspace, stdio: "ignore", windowsHide: true });
      child.once("error", () => reject(new Error("Could not start VS Code. Configure AYRA_VSCODE_COMMAND to its executable.")));
      child.once("spawn", () => {
        child.unref();
        resolve({ opened: path.relative(workspace, resolved) || "." });
      });
    });
  }

  if (action === "read_file") {
    const target = resolveInsideWorkspace(workspace, params.path);
    const resolved = await realpath(target);
    if (path.relative(workspace, resolved).startsWith(`..${path.sep}`) || path.isAbsolute(path.relative(workspace, resolved))) {
      throw new Error("Resolved file is outside the configured workspace.");
    }
    if (BLOCKED_PATH.test(path.relative(workspace, resolved))) throw new Error("Access to secret and credential paths is disabled.");
    if (!ALLOWED_EXTENSIONS.has(path.extname(resolved).toLowerCase())) throw new Error("This file type is not available to the local bridge.");
    const info = await stat(resolved);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error("File is missing or exceeds the 64 KiB limit.");
    const content = await readFile(resolved, "utf8");
    if (content.includes("\0")) throw new Error("Binary files cannot be read through the local bridge.");
    return { path: path.relative(workspace, resolved), content };
  }

  if (action === "run_command") {
    if (typeof params.command !== "string" || !ALLOWED_COMMANDS.has(params.command)) {
      throw new Error("Only the read-only git_status and git_recent commands are allowed.");
    }
    return { command: params.command, output: await runGit([...(ALLOWED_COMMANDS.get(params.command) ?? [])], workspace) };
  }

  throw new Error("Unsupported local bridge action.");
}

export async function createBridge({ workspace: workspaceInput, token, port = PORT } = {}) {
  if (typeof token !== "string" || Buffer.byteLength(token) < 32 || Buffer.byteLength(token) > 256) {
    throw new Error("AYRA_BRIDGE_TOKEN must contain between 32 and 256 bytes.");
  }
  if (typeof workspaceInput !== "string" || workspaceInput.length === 0) {
    throw new Error("Set AYRA_WORKSPACE to the workspace this agent may access.");
  }
  const workspace = await realpath(workspaceInput);
  const workspaceInfo = await stat(workspace);
  if (!workspaceInfo.isDirectory()) throw new Error("AYRA_WORKSPACE must be a directory.");

  const http = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true, bridge: "ayra-local" }));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });

  http.on("upgrade", (request, socket, head) => {
    const actualPort = http.address()?.port ?? port;
    const host = request.headers.host;
    const origin = request.headers.origin;
    if ((host !== `127.0.0.1:${actualPort}` && host !== `localhost:${actualPort}`)
      || !ALLOWED_ORIGINS.has(origin)
      || request.url !== "/bridge"
      || request.headers["sec-websocket-protocol"] !== "ayra-local-v1") {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request));
  });

  sockets.on("connection", (ws) => {
    let authenticated = false;
    let authAttempts = 0;
    let actionCount = 0;
    let actionWindowStart = Date.now();
    const authTimer = setTimeout(() => { if (!authenticated) ws.close(4001, "Authentication required"); }, 12_000);

    ws.on("message", async (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { ws.close(1003, "JSON required"); return; }
      if (!authenticated) {
        authAttempts += 1;
        if (message?.type !== "authenticate" || typeof message.token !== "string" || !equalSecret(message.token, token)) {
          if (authAttempts >= 3) ws.close(4003, "Pairing failed");
          else ws.send(JSON.stringify({ type: "authenticated", ok: false, error: "Pairing token rejected." }));
          return;
        }
        authenticated = true;
        clearTimeout(authTimer);
        ws.send(JSON.stringify({ type: "authenticated", ok: true }));
        return;
      }

      const requestId = typeof message?.id === "string" && message.id.length <= 80 ? message.id : null;
      if (message?.type !== "request" || !requestId || typeof message.action !== "string" || !message.params || typeof message.params !== "object") {
        ws.close(1008, "Invalid request");
        return;
      }
      if (Date.now() - actionWindowStart > 60_000) {
        actionWindowStart = Date.now();
        actionCount = 0;
      }
      actionCount += 1;
      if (actionCount > 30) {
        ws.send(JSON.stringify({ type: "response", id: requestId, ok: false, error: "Local bridge rate limit exceeded." }));
        return;
      }
      try {
        const result = await executeAction(message.action, message.params, workspace);
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "response", id: requestId, ok: true, result }));
      } catch (error) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "response", id: requestId, ok: false, error: error instanceof Error ? error.message : "Local action failed." }));
      }
    });
    ws.on("close", () => clearTimeout(authTimer));
  });

  await new Promise((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", resolve);
  });
  const address = http.address();
  const actualPort = address && typeof address === "object" ? address.port : port;
  return { http, sockets, workspace, port: actualPort };
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  createBridge({ workspace: process.env.AYRA_WORKSPACE, token: process.env.AYRA_BRIDGE_TOKEN })
    .then(({ workspace, port }) => console.log(`AYRA local bridge listening on 127.0.0.1:${port}; workspace: ${workspace}`))
    .catch((error) => { console.error(`[ayra-local] ${error.message}`); process.exitCode = 1; });
}
