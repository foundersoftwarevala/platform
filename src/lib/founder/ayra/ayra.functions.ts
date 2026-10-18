import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * AYRA's API.
 *
 * Both reads are executive-only. The capability register in particular says
 * which systems the platform is connected to and with what authority, which
 * is not something to expose to anyone who asks.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireExecutive(): Promise<string> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Sign-in required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  if (!url || !publishable) throw new Error("Authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Sign-in required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Sign-in required");

  const db = await admin();
  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
  ]);
  if (!isBoss && !isAdmin) throw new Error("Executive permission required");
  return user.id;
}

export interface AyraCapability {
  capability: string;
  label: string;
  connected: boolean;
  backing: string | null;
  notConnectedReason: string | null;
  impact: string;
  confirmsDelivery: boolean;
}

export interface AyraOrderStep {
  id: string;
  position: number;
  description: string;
  capability: string;
  state: string;
  result: string | null;
  blockedReason: string | null;
  error: string | null;
}

export interface AyraOrder {
  id: string;
  instruction: string;
  understoodAs: string | null;
  state: string;
  impact: string;
  report: string | null;
  reportedAt: string | null;
  blockedReason: string | null;
  failureReason: string | null;
  authorizedAt: string | null;
  createdAt: string;
  steps: AyraOrderStep[];
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows(path: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status}`);
  return (await response.json()) as Row[];
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** What AYRA is connected to, and what she is not. */
export const loadAyraCapabilities = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    capabilities: AyraCapability[];
    connected: number;
    notConnected: number;
  }> => {
    await requireExecutive();
    const data = await rows("ayra_capabilities?select=*&order=connected.desc,capability.asc");
    const capabilities = data.map((row): AyraCapability => ({
      capability: str(row, "capability") ?? "",
      label: str(row, "label") ?? "",
      connected: row.connected === true,
      backing: str(row, "backing"),
      notConnectedReason: str(row, "not_connected_reason"),
      impact: str(row, "impact") ?? "LOW",
      confirmsDelivery: row.confirms_delivery === true,
    }));
    return {
      capabilities,
      connected: capabilities.filter((c) => c.connected).length,
      notConnected: capabilities.filter((c) => !c.connected).length,
    };
  },
);

/** What AYRA has been asked to do, and what became of it. */
export const loadAyraOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ orders: AyraOrder[]; degraded: string[] }> => {
    await requireExecutive();
    const degraded: string[] = [];

    let orderRows: Row[] = [];
    try {
      orderRows = await rows("ayra_orders?select=*&order=created_at.desc&limit=50");
    } catch (error) {
      console.error("[ayra] orders unavailable:", error);
      return { orders: [], degraded: ["ayra_orders"] };
    }
    if (orderRows.length === 0) return { orders: [], degraded };

    const ids = orderRows.map((o) => `"${String(o.id)}"`).join(",");
    const stepRows = await rows(
      `ayra_order_steps?select=*&order_id=in.(${ids})&order=position.asc&limit=500`,
    ).catch(() => {
      degraded.push("ayra_order_steps");
      return [] as Row[];
    });

    const byOrder = new Map<string, AyraOrderStep[]>();
    for (const row of stepRows) {
      const key = String(row.order_id);
      const step: AyraOrderStep = {
        id: String(row.id),
        position: Number(row.position ?? 0),
        description: str(row, "description") ?? "",
        capability: str(row, "capability") ?? "",
        state: str(row, "state") ?? "PLANNED",
        result: str(row, "result"),
        blockedReason: str(row, "blocked_reason"),
        error: str(row, "error"),
      };
      byOrder.set(key, [...(byOrder.get(key) ?? []), step]);
    }

    return {
      orders: orderRows.map((row): AyraOrder => ({
        id: String(row.id),
        instruction: str(row, "instruction") ?? "",
        understoodAs: str(row, "understood_as"),
        state: str(row, "state") ?? "RECEIVED",
        impact: str(row, "impact") ?? "LOW",
        report: str(row, "report"),
        reportedAt: str(row, "reported_at"),
        blockedReason: str(row, "blocked_reason"),
        failureReason: str(row, "failure_reason"),
        authorizedAt: str(row, "authorized_at"),
        createdAt: str(row, "created_at") ?? "",
        steps: byOrder.get(String(row.id)) ?? [],
      })),
      degraded,
    };
  },
);
