/**
 * Demo URL Center data layer — CRUD, enable/disable, duplicate, live health
 * checks and an audit trail, kept client-side in this project.
 */
import { createTable, uid } from "./store";
import { authHeaders } from "@/lib/auth/operator-fetch";

export type DemoAuditEntry = {
  id: string;
  demo_url_id: string | null;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  metadata: any;
  created_at: string;
};

export type DemoUrl = {
  id: string;
  product_id: string | null;
  demo_name: string;
  role_name: string;
  url: string;
  username: string | null;
  password: string | null;
  description: string | null;
  environment: "production" | "staging" | "testing";
  status: "active" | "inactive";
  sort_order: number;
  last_checked_at: string | null;
  last_response_ms: number | null;
  last_http_status: number | null;
  last_result: "working" | "slow" | "offline" | "unknown";
  ssl_valid: boolean | null;
  created_at: string;
  updated_at: string;
};

const now = () => new Date().toISOString();

const SEED: DemoUrl[] = [
  {
    id: "demo-erp-admin", product_id: "prd-erp-suite", demo_name: "Vala ERP Suite", role_name: "Admin",
    url: "https://demo.softwarevala.com/erp/admin", username: "admin@demo.io", password: "demo1234",
    description: "Full ERP admin workspace", environment: "production", status: "active", sort_order: 0,
    last_checked_at: null, last_response_ms: null, last_http_status: null, last_result: "unknown",
    ssl_valid: null, created_at: now(), updated_at: now(),
  },
  {
    id: "demo-crm-sales", product_id: "prd-crm-pro", demo_name: "Vala CRM Pro", role_name: "Sales Rep",
    url: "https://demo.softwarevala.com/crm/sales", username: "sales@demo.io", password: "demo1234",
    description: "Pipeline and lead views", environment: "staging", status: "active", sort_order: 1,
    last_checked_at: null, last_response_ms: null, last_http_status: null, last_result: "unknown",
    ssl_valid: null, created_at: now(), updated_at: now(),
  },
];

const demos = createTable<DemoUrl>("demo_urls", SEED);
const audit = createTable<DemoAuditEntry>("demo_audit", []);

function log(action: string, demoUrlId: string | null, metadata: Record<string, unknown>) {
  audit.upsert({
    id: uid(),
    demo_url_id: demoUrlId,
    action,
    actor_id: null,
    actor_email: "manager@softwarevala.com",
    metadata,
    created_at: now(),
  });
}

const ENDPOINT = "/api/manager/resource";

async function refusal(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return "Sign in as an operator to manage demo addresses.";
  }
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "The demo addresses could not be read.";
  } catch {
    return "The demo addresses could not be read.";
  }
}

async function readAll<T>(resource: string): Promise<T[]> {
  const rows: T[] = [];
  const PAGE = 200;
  for (let offset = 0; offset < 10000; offset += PAGE) {
    const response = await fetch(
      `${ENDPOINT}?resource=${resource}&limit=${PAGE}&offset=${offset}`,
      { headers: await authHeaders() },
    );
    if (!response.ok) {
      if (offset === 0) throw new Error(await refusal(response));
      break;
    }
    const payload = (await response.json()) as { rows?: T[] };
    const page = payload.rows ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function writeRow(id: string | undefined, values: Record<string, unknown>): Promise<DemoUrl> {
  const response = id
    ? await fetch(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ resource: "demos", id, changes: values }),
      })
    : await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ resource: "demos", values }),
      });
  if (!response.ok) throw new Error(await refusal(response));
  const payload = (await response.json()) as { row?: DemoUrl };
  if (!payload.row) throw new Error("The server did not return the saved address.");
  return payload.row;
}

/** Record what an operator did, where the rest of the team can see it. */
async function record(action: string, demoUrlId: string | null, metadata: Record<string, unknown>) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        resource: "demo_audit",
        values: { demo_url_id: demoUrlId, action, metadata },
      }),
    });
  } catch {
    // An address that changed must not fail because its note did not save.
  }
}

export async function listDemoUrls(): Promise<DemoUrl[]> {
  const rows = await readAll<DemoUrl>("demos");
  return rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export async function upsertDemoUrl(arg: { data: Partial<DemoUrl> }): Promise<DemoUrl> {
  const input = { ...arg.data };
  const id = input.id;
  delete input.id;
  const saved = await writeRow(id, input as Record<string, unknown>);
  await record(id ? "demo_url.update" : "demo_url.create", saved.id, {
    demo_name: saved.demo_name, role_name: saved.role_name,
    environment: saved.environment, status: saved.status,
  });
  return saved;
}

/** Made inactive, not removed. */
export async function deleteDemoUrl(arg: { data: { id: string } }) {
  const response = await fetch(
    `${ENDPOINT}?resource=demos&id=${encodeURIComponent(arg.data.id)}`,
    { method: "DELETE", headers: await authHeaders() },
  );
  if (!response.ok) throw new Error(await refusal(response));
  await record("demo_url.retire", arg.data.id, {});
  return { ok: true };
}

export async function duplicateDemoUrl(arg: { data: { id: string } }): Promise<DemoUrl> {
  const all = await listDemoUrls();
  const src = all.find((row) => row.id === arg.data.id);
  if (!src) throw new Error("Not found");
  const saved = await writeRow(undefined, {
    product_id: src.product_id,
    demo_name: `${src.demo_name} (copy)`,
    role_name: src.role_name,
    url: src.url,
    username: src.username,
    password: src.password,
    description: src.description,
    environment: src.environment,
    status: "inactive",
    sort_order: src.sort_order,
  });
  await record("demo_url.duplicate", saved.id, { source_id: arg.data.id });
  return saved;
}

export async function toggleDemoUrl(arg: { data: { id: string; status: "active" | "inactive" } }) {
  await writeRow(arg.data.id, { status: arg.data.status });
  await record(
    arg.data.status === "active" ? "demo_url.enable" : "demo_url.disable",
    arg.data.id,
    { status: arg.data.status },
  );
  return { ok: true };
}

async function checkOnce(url: string) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { method: "GET", mode: "no-cors", redirect: "follow", signal: controller.signal });
      const ms = Date.now() - start;
      const status = res.status || 200;
      const ok = res.type === "opaque" || (status >= 200 && status < 400);
      const result: DemoUrl["last_result"] = !ok ? "offline" : ms > 2500 ? "slow" : "working";
      return { ok, status, ms, result, ssl: url.startsWith("https://") ? ok : null };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start, result: "offline" as const, ssl: null };
  }
}

async function runCheck(row: DemoUrl) {
  const r = await checkOnce(row.url);
  const patch = {
    last_checked_at: now(),
    last_response_ms: r.ms,
    last_http_status: r.status,
    last_result: r.result,
    ssl_valid: r.ssl,
  };
  // The result is stored against the address itself, so the next person to open
  // the console sees when it was last reached rather than "never checked".
  await writeRow(row.id, patch);
  await record("demo_url.test", row.id, {
    http_status: r.status, response_ms: r.ms, result: r.result, ssl_valid: r.ssl,
  });
  return { id: row.id, ...patch };
}

export async function testDemoUrl(arg: { data: { id: string } }) {
  const all = await listDemoUrls();
  const row = all.find((d) => d.id === arg.data.id);
  if (!row) throw new Error("Not found");
  return runCheck(row);
}

export async function testAllDemoUrls() {
  const all = await listDemoUrls();
  const active = all.filter((d) => d.status === "active");
  const results: Awaited<ReturnType<typeof runCheck>>[] = [];
  // One at a time: a sweep of every address at once is a burst of traffic at
  // the hosts that carry the demos.
  for (const row of active) results.push(await runCheck(row));
  await record("demo_url.test_all", null, { count: results.length });
  return results;
}

export async function listDemoAuditLog(arg?: { data?: { demo_url_id?: string; limit?: number } }) {
  const limit = arg?.data?.limit ?? 100;
  const filterId = arg?.data?.demo_url_id;
  const rows = await readAll<DemoAuditEntry>("demo_audit");
  return rows
    .filter((a) => (filterId ? a.demo_url_id === filterId : true))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}
