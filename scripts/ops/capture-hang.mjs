/**
 * What the hung server process is actually waiting on.
 *
 * RUN THIS ON THE SERVER, against the process that holds port 3000.
 *
 * It does not change the application. It opens Node's own inspector with
 * SIGUSR1, asks the runtime what it is doing, and detaches. Nothing is
 * evaluated that mutates state: the stack, the pending handles and the pending
 * requests are read, and that is all.
 *
 *   node scripts/ops/capture-hang.mjs <pid>
 *
 * The process is left running. SIGUSR1 leaves the inspector listening on
 * 127.0.0.1:9229, which is loopback-only; nothing outside the box can reach it.
 */
import { execFileSync } from "node:child_process";

const pid = process.argv[2];
if (!pid) {
  console.error("usage: node capture-hang.mjs <pid>");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`target pid ${pid}`);
console.log("opening the inspector with SIGUSR1 (does not alter the application)");
try {
  execFileSync("kill", ["-SIGUSR1", pid]);
} catch (e) {
  console.error("  could not signal:", e.message);
  process.exit(1);
}
await sleep(1500);

let targets;
for (let i = 0; i < 10; i++) {
  try {
    targets = await (await fetch("http://127.0.0.1:9229/json/list")).json();
    if (targets?.length) break;
  } catch { /* not up yet */ }
  await sleep(700);
}
if (!targets?.length) {
  console.error("  the inspector never came up on 127.0.0.1:9229");
  process.exit(1);
}
const wsUrl = targets[0].webSocketDebuggerUrl;
console.log(`  inspector: ${targets[0].title}\n`);

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const events = [];

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    events.push(msg);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await new Promise((r) => ws.addEventListener("open", r));

/** Evaluate an expression in the target and return its string value. */
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: false,
    timeout: 5000,
  });
  if (r.result?.exceptionDetails) return `<threw: ${r.result.exceptionDetails.text}>`;
  return r.result?.result?.value ?? "<no value>";
}

await send("Runtime.enable");

console.log("=== what the event loop is holding ===");
console.log(
  await evaluate(`(() => {
    const h = process._getActiveHandles ? process._getActiveHandles() : [];
    const r = process._getActiveRequests ? process._getActiveRequests() : [];
    const kinds = {};
    for (const x of h) { const k = x?.constructor?.name ?? typeof x; kinds[k] = (kinds[k] ?? 0) + 1; }
    const rkinds = {};
    for (const x of r) { const k = x?.constructor?.name ?? typeof x; rkinds[k] = (rkinds[k] ?? 0) + 1; }
    return "  handles : " + JSON.stringify(kinds) +
         "\\n  requests: " + JSON.stringify(rkinds) +
         "\\n  uptime  : " + Math.round(process.uptime()) + "s";
  })()`),
);

console.log("\n=== module resolution state (the server entry) ===");
console.log(
  await evaluate(`(() => {
    try {
      const g = globalThis;
      const keys = Object.getOwnPropertyNames(g).filter(k => /serverEntry|__tsr|__TSR|nitro/i.test(k));
      return "  suspicious globals: " + (keys.length ? keys.join(", ") : "(none)");
    } catch (e) { return "  " + e.message; }
  })()`),
);

console.log("\n=== pausing to read the JavaScript stack ===");
await send("Debugger.enable");
await send("Debugger.pause");
await sleep(1200);

const paused = events.find((e) => e.method === "Debugger.paused");
if (!paused) {
  console.log("  the runtime never reported a pause - it is idle, not executing JavaScript.");
  console.log("  That is itself the finding: nothing is running; something is awaited and never settles.");
} else {
  const frames = paused.params.callFrames ?? [];
  console.log(`  paused, ${frames.length} frames:`);
  for (const f of frames.slice(0, 25)) {
    const loc = f.url || f.functionLocation?.scriptId || "?";
    console.log(`    ${(f.functionName || "(anonymous)").padEnd(34)} ${loc.split("/").pop()}:${f.location.lineNumber + 1}`);
  }
}
await send("Debugger.resume").catch(() => {});
await send("Debugger.disable").catch(() => {});

console.log("\n=== async stacks of anything still pending ===");
console.log(
  await evaluate(`(() => {
    try {
      const h = (process._getActiveHandles ? process._getActiveHandles() : []);
      const out = [];
      for (const x of h.slice(0, 12)) {
        const k = x?.constructor?.name ?? typeof x;
        let detail = "";
        if (k === "Socket" || k === "TLSSocket") {
          detail = (x.remoteAddress ?? "?") + ":" + (x.remotePort ?? "?") + " readable=" + !!x.readable;
        } else if (k === "Server") {
          const a = x.address && x.address(); detail = a ? (a.address + ":" + a.port) : "";
        } else if (k === "Timeout") {
          detail = "after=" + (x._idleTimeout ?? "?");
        }
        out.push("  " + k + (detail ? "  " + detail : ""));
      }
      return out.join("\\n") || "  (no handles)";
    } catch (e) { return "  " + e.message; }
  })()`),
);

ws.close();
console.log("\ndetached. The process was not modified and is still running.");
