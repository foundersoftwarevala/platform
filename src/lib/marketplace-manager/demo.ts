/**
 * Demo URL Center data layer — CRUD, enable/disable, duplicate, live health
 * checks and an audit trail, kept client-side in this project.
 */
import { createTable, uid } from "./store";

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

export async function listDemoUrls(): Promise<DemoUrl[]> {
  return [...demos.all()].sort((a, b) => a.sort_order - b.sort_order);
}

export async function upsertDemoUrl(arg: { data: Partial<DemoUrl> }): Promise<DemoUrl> {
  const input = arg.data;
  const isUpdate = !!input.id;
  const id = input.id ?? uid();
  const existing = isUpdate ? demos.find(id) : undefined;
  const row: DemoUrl = {
    ...(existing ?? {
      id, product_id: null, demo_name: "", role_name: "", url: "", username: null, password: null,
      description: null, environment: "production", status: "active", sort_order: demos.all().length,
      last_checked_at: null, last_response_ms: null, last_http_status: null,
      last_result: "unknown", ssl_valid: null, created_at: now(), updated_at: now(),
    }),
    ...input,
    id,
    updated_at: now(),
  };
  const saved = demos.upsert(row);
  log(isUpdate ? "demo_url.update" : "demo_url.create", saved.id, {
    demo_name: saved.demo_name, role_name: saved.role_name, url: saved.url,
    environment: saved.environment, status: saved.status,
  });
  return saved;
}

export async function deleteDemoUrl(arg: { data: { id: string } }) {
  const prev = demos.find(arg.data.id);
  demos.remove(arg.data.id);
  log("demo_url.delete", arg.data.id, { demo_name: prev?.demo_name, url: prev?.url });
  return { ok: true };
}

export async function duplicateDemoUrl(arg: { data: { id: string } }): Promise<DemoUrl> {
  const src = demos.find(arg.data.id);
  if (!src) throw new Error("Not found");
  const copy: DemoUrl = {
    ...src,
    id: uid(),
    demo_name: `${src.demo_name} (copy)`,
    created_at: now(),
    updated_at: now(),
  };
  const saved = demos.upsert(copy);
  log("demo_url.duplicate", saved.id, { source_id: arg.data.id, demo_name: saved.demo_name });
  return saved;
}

export async function toggleDemoUrl(arg: { data: { id: string; status: "active" | "inactive" } }) {
  demos.patch(arg.data.id, { status: arg.data.status, updated_at: now() });
  log(arg.data.status === "active" ? "demo_url.enable" : "demo_url.disable", arg.data.id, {
    status: arg.data.status,
  });
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

async function runCheck(id: string) {
  const row = demos.find(id);
  if (!row) throw new Error("Not found");
  const r = await checkOnce(row.url);
  const patch = {
    last_checked_at: now(),
    last_response_ms: r.ms,
    last_http_status: r.status,
    last_result: r.result,
    ssl_valid: r.ssl,
  };
  demos.patch(id, patch);
  log("demo_url.test", id, {
    http_status: r.status, response_ms: r.ms, result: r.result, ssl_valid: r.ssl,
  });
  return { id, ...patch };
}

export async function testDemoUrl(arg: { data: { id: string } }) {
  return runCheck(arg.data.id);
}

export async function testAllDemoUrls() {
  const active = demos.all().filter((d) => d.status === "active");
  const results = await Promise.all(active.map((d) => runCheck(d.id)));
  log("demo_url.test_all", null, { count: results.length });
  return results;
}

export async function listDemoAuditLog(arg?: { data?: { demo_url_id?: string; limit?: number } }) {
  const limit = arg?.data?.limit ?? 100;
  const filterId = arg?.data?.demo_url_id;
  return audit
    .all()
    .filter((a) => (filterId ? a.demo_url_id === filterId : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
