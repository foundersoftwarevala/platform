import { supabase } from "@/integrations/supabase/client";

/**
 * Shared reads for the Demo Manager alert screens (Uptime & Alerts, the
 * notifications sheet). Both used to render arrays typed into their files -
 * "Finance Portal" timing out, "All 47 demos passed" - on demos this platform
 * does not sell.
 *
 * demo_alerts is where the monitor writes offline / slow / SSL alerts, keyed by
 * demo_url_id; product_demo_urls names the demo. demo_health holds every
 * monitor check. demo_url_id is missing from the generated types for both
 * tables, hence the untyped client below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DemoAlertRow = {
  id: string;
  demo_url_id: string | null;
  demo_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  demoName: string;
};

export type DemoHealthLogRow = {
  id: string;
  demo_url_id: string | null;
  status: string;
  response_time: number | null;
  http_status: number | null;
  error_message: string | null;
  checked_at: string;
  demoName: string;
};

export const demoAlertsKey = ["demo-manager", "demo-alerts"] as const;
export const demoHealthLogKey = ["demo-manager", "demo-health-log"] as const;

/** id -> demo name, from the table the storefront serves. */
async function demoNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return names;
  const { data, error } = await db
    .from("product_demo_urls")
    .select("id, demo_name")
    .in("id", unique);
  // A name that cannot be read is not a reason to hide the alert itself.
  if (error) return names;
  for (const row of (data ?? []) as { id: string; demo_name: string | null }[]) {
    if (row.demo_name) names.set(row.id, row.demo_name);
  }
  return names;
}

export async function fetchDemoAlerts(limit = 50): Promise<DemoAlertRow[]> {
  const { data, error } = await db
    .from("demo_alerts")
    .select(
      "id, demo_url_id, demo_id, alert_type, severity, message, is_resolved, resolved_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Omit<DemoAlertRow, "demoName">[];
  const names = await demoNames(rows.map((r) => r.demo_url_id ?? ""));
  return rows.map((r) => ({
    ...r,
    demoName: (r.demo_url_id && names.get(r.demo_url_id)) || "Unnamed demo",
  }));
}

export async function fetchDemoHealthLog(limit = 25): Promise<DemoHealthLogRow[]> {
  const { data, error } = await db
    .from("demo_health")
    .select("id, demo_url_id, status, response_time, http_status, error_message, checked_at")
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Omit<DemoHealthLogRow, "demoName">[];
  const names = await demoNames(rows.map((r) => r.demo_url_id ?? ""));
  return rows.map((r) => ({
    ...r,
    demoName: (r.demo_url_id && names.get(r.demo_url_id)) || "Unnamed demo",
  }));
}

/**
 * demo_alerts records acknowledgement as resolution; it has no column for a
 * note. The note describing the action taken is written to demo_url_audit_log
 * (the Demo Manager's activity log) against the same demo URL, so it is kept
 * and shows in Activity Logs.
 */
export async function resolveDemoAlert(
  id: string,
  note?: string,
  demoName?: string,
): Promise<{ noteSaved: boolean }> {
  const { data, error } = await db
    .from("demo_alerts")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, demo_url_id");
  if (error) throw error;
  // An update the access policy filtered out comes back as zero rows, not an error.
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "The alert was not updated - your role may not be allowed to resolve demo alerts.",
    );
  }
  const trimmed = note?.trim();
  if (!trimmed) return { noteSaved: false };

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user)
    throw new Error("The alert was resolved, but the note was not saved: you are signed out.");
  const { error: logError } = await db.from("demo_url_audit_log").insert({
    demo_url_id: (data[0] as { demo_url_id: string | null }).demo_url_id ?? null,
    action: "demo_alert.resolved",
    actor_id: user.id,
    actor_email: user.email ?? null,
    metadata: { module: "uptime_alerts", alert_id: id, demo_name: demoName ?? null, note: trimmed },
  });
  if (logError)
    throw new Error(`The alert was resolved, but the note was not saved: ${logError.message}`);
  return { noteSaved: true };
}

export const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
};
