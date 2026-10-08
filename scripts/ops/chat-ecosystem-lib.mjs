/**
 * Shared helpers for the Chat ecosystem live checks: test-account tokens from
 * the platform's own sign-in, direct calls to the deployed server functions
 * (exactly what the browser sends: x-tsr-serverFn, the person's bearer token,
 * a seroval payload), and SQL against the VPS database.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";

const plugins = defaultSerovalPlugins;

export const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
export const BASE = process.env.SV_E2E_BASE ?? "https://softwarevala.net";

export function sql(q) {
  let r;
  for (let attempt = 1; ; attempt++) {
    r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", q], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const unreached =
      /ssh: connect to host .* (timed out|refused)|Connection reset by peer|kex_exchange_identification/.test(
        `${r.stdout ?? ""}${r.stderr ?? ""}`,
      );
    if (!unreached || attempt === 4) break;
  }
  const out = r.stdout ?? "";
  if (r.status !== 0 || /\b(ERROR|FATAL|PANIC):/.test(`${out}\n${r.stderr ?? ""}`))
    throw new Error(`${r.stderr ?? ""}${out}`.slice(0, 800));
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^target\s+:|^-+(\+-+)*$|rows?\)$|^(BEGIN|COMMIT|ALTER TABLE|DELETE \d+|UPDATE \d+|INSERT \d+ \d+)$/.test(
          l,
        ),
    );
}
/** First cell of the first row. */
export const one = (q) => (sql(q)[1] ?? "").split("|")[0].trim();
/** Rows as arrays of trimmed cells (header dropped). */
export const rows = (q) =>
  sql(q)
    .slice(1)
    .map((l) => l.split("|").map((c) => c.trim()));

export async function token(email, password) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ops.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return { token: body.access_token, id: body.user.id };
}

let ids = null;
export function functionIds(map) {
  ids = map;
}

/** Call a deployed server function as a person. Resolves { ok, status, value, error }. */
export async function call(auth, name, method, data) {
  const id = ids?.[name];
  if (!id) throw new Error(`unknown server function ${name}`);
  const payload =
    data === undefined ? undefined : JSON.stringify(await toJSONAsync({ data }, { plugins }));
  let url = `${BASE}/_serverFn/${id}`;
  const headers = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
    origin: BASE,
    referer: `${BASE}/chat`,
    "sec-fetch-site": "same-origin",
  };
  if (auth) headers.authorization = `Bearer ${auth.token}`;
  let body;
  if (method === "GET") {
    if (payload) url += `?payload=${encodeURIComponent(payload)}`;
  } else if (payload) {
    body = payload;
    headers["content-type"] = "application/json";
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let value = null;
  let thrown = null;
  try {
    const envelope = fromCrossJSON(JSON.parse(text), { plugins, refs: new Map() });
    value = envelope?.result;
    if (envelope?.error) thrown = envelope.error.message ?? String(envelope.error);
  } catch {
    value = text;
  }
  const refused = value && typeof value === "object" && value.ok === false ? value.error : null;
  return {
    ok: res.ok && !thrown && !refused,
    status: res.status,
    value,
    error: thrown ?? refused ?? (res.ok ? null : text.slice(0, 200)),
  };
}

/** Collect the notification stream of a person for `ms` milliseconds. */
export async function listen(auth, ms) {
  const events = [];
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(`${BASE}/api/notifications/stream`, {
      headers: { authorization: `Bearer ${auth.token}`, accept: "text/event-stream" },
      signal: ac.signal,
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let at;
      while ((at = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, at);
        buf = buf.slice(at + 2);
        const data = block.split("\n").find((l) => l.startsWith("data: "));
        if (block.includes("event: notification") && data) events.push(JSON.parse(data.slice(6)));
      }
    }
  } catch {
    /* aborted at the end of the window */
  } finally {
    clearTimeout(timer);
  }
  return events;
}

/** The deployed build's server-function ids, read from its resolver on the VPS. */
export function loadFunctionIds() {
  const keyPath = (ops.SV_SSH_KEY ?? "").replace(
    /^~/,
    process.env.HOME ?? process.env.USERPROFILE ?? "~",
  );
  const r = spawnSync(
    "ssh",
    [
      "-i",
      keyPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      ops.SV_SSH_HOST,
      "cat /var/www/softwarevala/.output/server/__23tanstack-start-server-fn-resolver-*.mjs",
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const map = {};
  let id = null;
  for (const line of (r.stdout ?? "").split("\n")) {
    const key = line.match(/^\s*"([0-9a-f]{64}(?:_\d+)?)": \{/);
    if (key) id = key[1];
    const fn = line.match(/functionName: "([A-Za-z0-9]+)_createServerFn_handler"/);
    if (fn && id) {
      if (map[fn[1]]) map[fn[1]] = "AMBIGUOUS";
      else map[fn[1]] = id;
      id = null;
    }
  }
  if (Object.keys(map).length === 0)
    throw new Error("could not read the deployed server functions");
  functionIds(map);
  return map;
}
