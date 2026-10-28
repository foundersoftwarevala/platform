import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import type { CEOSuggestion } from "./types";

const CATEGORY = "ai_ceo";

export const KEYS = {
  suggestions: "ai_ceo.suggestions",
  bossQueue: "ai_ceo.boss_queue",
  lastRefresh: "ai_ceo.last_refresh",
} as const;

const LABELS: Record<string, string> = {
  [KEYS.suggestions]: "AI CEO suggestions",
  [KEYS.bossQueue]: "AI CEO boss review queue",
  [KEYS.lastRefresh]: "AI CEO last refresh",
};

async function readKey<T>(key: string, fallback: T): Promise<T> {
  const [row] = await withVpsPublicDatabase(
    (tx) => tx<{ value: string | null }[]>`
    select value from public.system_settings where key = ${key} limit 1
  `,
  );
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    console.error(`[ai-ceo] ${key} does not contain valid JSON; using the fallback`);
    return fallback;
  }
}

async function writeKey(key: string, value: unknown): Promise<boolean> {
  try {
    const [row] = await withVpsPublicDatabase(
      (tx) => tx<{ key: string }[]>`
      insert into public.system_settings (key, label, value, value_type, category, updated_at)
      values (${key}, ${LABELS[key] ?? key}, ${JSON.stringify(value)}, 'json', ${CATEGORY}, now())
      on conflict (key) do update set
        label = excluded.label,
        value = excluded.value,
        value_type = excluded.value_type,
        category = excluded.category,
        updated_at = excluded.updated_at
      returning key
    `,
    );
    return Boolean(row?.key);
  } catch (error) {
    console.error(`[ai-ceo] could not write ${key}:`, error);
    return false;
  }
}

export async function readSuggestions(): Promise<CEOSuggestion[]> {
  return readKey<CEOSuggestion[]>(KEYS.suggestions, []);
}

export async function writeSuggestions(rows: CEOSuggestion[]): Promise<boolean> {
  return writeKey(KEYS.suggestions, rows);
}

export async function readLiveBossSuggestions(): Promise<CEOSuggestion[]> {
  const rows = await withVpsPublicDatabase(
    (tx) => tx<
      {
        id: string;
        title: string;
        detail: string;
        domain: string;
        severity: string;
        detected_at: string;
      }[]
    >`
    select i.id, i.title, i.detail, i.domain, i.severity::text as severity,
           i.detected_at::text as detected_at
      from public.founder_incidents i
     where i.severity::text in ('HIGH', 'CRITICAL')
       and i.state::text not in ('RESOLVED', 'CONTAINED')
       and i.detected_at >= now() - interval '48 hours'
       and not exists (
         select 1 from public.ai_decision_logs d
          where d.source_key = 'live_incident:' || i.id::text
       )
     order by case i.severity::text when 'CRITICAL' then 0 else 1 end,
              i.detected_at desc
     limit 50
  `,
  );
  return rows.map((row) => ({
    id: `incident:${row.id}`,
    type: "risk",
    title: `Review active ${row.severity.toLowerCase()} incident: ${row.title}`,
    description: row.detail,
    confidence: null,
    impact: "high",
    impactArea: row.domain,
    status: "pending",
    createdAt: row.detected_at,
    source: "System",
  }));
}

export async function readBossQueue(): Promise<CEOSuggestion[]> {
  return readKey<CEOSuggestion[]>(KEYS.bossQueue, []);
}

export async function writeBossQueue(rows: CEOSuggestion[]): Promise<boolean> {
  return writeKey(KEYS.bossQueue, rows);
}

export async function readLastRefresh(): Promise<string | null> {
  const row = await readKey<{ at: string | null }>(KEYS.lastRefresh, { at: null });
  return row.at ?? null;
}

export async function writeLastRefresh(at: string): Promise<boolean> {
  return writeKey(KEYS.lastRefresh, { at });
}

export async function setSuggestionStatus(
  id: string,
  status: CEOSuggestion["status"],
): Promise<{ ok: boolean; suggestion: CEOSuggestion | null }> {
  const rows = await readSuggestions();
  const found = rows.find((suggestion) => suggestion.id === id) ?? null;
  if (!found) return { ok: false, suggestion: null };

  const next = rows.map((suggestion) =>
    suggestion.id === id ? { ...suggestion, status } : suggestion,
  );
  const ok = await writeSuggestions(next);
  return { ok, suggestion: ok ? { ...found, status } : found };
}

export async function decideBossSuggestion(
  id: string,
  decision: "approved" | "rejected",
  actorId: string,
): Promise<{ ok: boolean; status?: CEOSuggestion["status"]; notified?: number; error?: string }> {
  return withVpsPublicDatabase(async (tx) => {
    const stored = await tx<{ key: string; value: string | null }[]>`
      select key, value from public.system_settings
       where key = any(${[KEYS.suggestions, KEYS.bossQueue]}::text[])
       for update
    `;
    const values = new Map(stored.map((row) => [row.key, row.value]));
    const parseRows = (key: string): CEOSuggestion[] => {
      const raw = values.get(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error(`${key} is not a JSON array`);
      return parsed as CEOSuggestion[];
    };
    const suggestions = parseRows(KEYS.suggestions);
    const queue = parseRows(KEYS.bossQueue);
    const suggestion =
      suggestions.find((row) => row.id === id) ?? queue.find((row) => row.id === id);
    if (!suggestion) return { ok: false, error: "Suggestion not found" };

    const status: CEOSuggestion["status"] =
      decision === "approved" ? "manual_action_required" : "rejected";
    const nextSuggestions = suggestions.map((row) => (row.id === id ? { ...row, status } : row));
    const nextQueue = queue.map((row) => (row.id === id ? { ...row, status } : row));
    await tx`
      insert into public.system_settings (key, label, value, value_type, category, updated_at)
      values (${KEYS.suggestions}, ${LABELS[KEYS.suggestions]}, ${JSON.stringify(nextSuggestions)}, 'json', ${CATEGORY}, now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
    `;
    await tx`
      insert into public.system_settings (key, label, value, value_type, category, updated_at)
      values (${KEYS.bossQueue}, ${LABELS[KEYS.bossQueue]}, ${JSON.stringify(nextQueue)}, 'json', ${CATEGORY}, now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
    `;

    let notified = 0;
    const area = suggestion.impactArea.toLowerCase();
    const managerRoles = area.includes("sales")
      ? ["sales", "sales_support_manager"]
      : area.includes("support") || area.includes("customer")
        ? ["support"]
        : area.includes("finance") || area.includes("billing")
          ? ["finance", "finance_manager"]
          : area.includes("legal") || area.includes("compliance")
            ? ["legal"]
            : area.includes("marketing")
              ? ["marketing"]
              : area.includes("seo")
                ? ["seo"]
                : [];
    const targetRoles = [...new Set([...managerRoles, "boss", "admin", "super_admin"])];
    const targetRolesJson = JSON.stringify(targetRoles);
    if (decision === "approved") {
      const notifications = await tx<{ id: string }[]>`
        insert into public.user_notifications
          (user_id, type, message, event_type, action_label, action_url, is_buzzer, role_target)
        select distinct ur.user_id, 'warning',
               ${`Approval requires manual action: ${suggestion.title}`},
               'ai_ceo_manual_action_required', 'Review', '/ai-ceo/approvals', true,
               array(select jsonb_array_elements_text(${targetRolesJson}::jsonb))
          from public.user_roles ur
         where ur.role::text in (select jsonb_array_elements_text(${targetRolesJson}::jsonb))
        returning id
      `;
      notified = notifications.length;
    }

    await tx`
      insert into public.audit_logs
        (occurred_at, actor, action, entity_type, entity_id, severity, metadata)
      values
        (now(), ${actorId}, ${decision === "approved" ? "ai_ceo_approval_manual_action_required" : "ai_ceo_suggestion_rejected"},
         'ai_ceo_suggestion', ${id}, ${decision === "approved" ? "warning" : "info"},
         ${JSON.stringify({ title: suggestion.title, impactArea: suggestion.impactArea, targetRoles, notified })}::jsonb)
    `;

    return { ok: true, status, notified };
  });
}

export async function decideLiveIncident(
  incidentId: string,
  decision: "approved" | "rejected",
  actorId: string,
): Promise<{ ok: boolean; status?: CEOSuggestion["status"]; notified?: number; error?: string }> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incidentId)
  ) {
    return { ok: false, error: "Invalid incident id" };
  }
  return withVpsPublicDatabase(async (tx) => {
    const [incident] = await tx<
      {
        id: string;
        title: string;
        detail: string;
        domain: string;
        severity: string;
        state: string;
      }[]
    >`
      select id, title, detail, domain, severity::text as severity, state::text as state
        from public.founder_incidents
       where id = ${incidentId}::uuid
       for update
    `;
    if (!incident || ["RESOLVED", "CONTAINED"].includes(incident.state)) {
      return { ok: false, error: "The incident is no longer awaiting review" };
    }

    const status = decision === "approved" ? "accepted" : "overridden";
    const humanAction = decision === "approved" ? "approved_manual_action_required" : "rejected";
    const sourceKey = `live_incident:${incident.id}`;
    const logs = await tx<{ id: string }[]>`
      insert into public.ai_decision_logs
        (decision, confidence, input_summary, output_summary, outcome,
         decision_type, status, human_action, human_action_by, source_key)
      values
        (${`Review incident: ${incident.title}`}, 0, ${incident.detail},
         ${decision === "approved" ? "Approved; manual action is required and has not been executed." : "Rejected by an executive reviewer."},
         ${status}, 'live_incident_review', ${status}, ${humanAction}, ${actorId}::uuid, ${sourceKey})
      on conflict (source_key) where source_key is not null do nothing
      returning id
    `;
    if (!logs.length) return { ok: false, error: "This incident has already been reviewed" };

    let notified = 0;
    const area = incident.domain.toLowerCase();
    const managerRoles = area.includes("sales")
      ? ["sales", "sales_support_manager"]
      : area.includes("support") || area.includes("customer")
        ? ["support"]
        : area.includes("finance")
          ? ["finance", "finance_manager"]
          : area.includes("legal")
            ? ["legal"]
            : area.includes("marketing")
              ? ["marketing"]
              : area.includes("seo")
                ? ["seo"]
                : [];
    const targetRoles = [...new Set([...managerRoles, "boss", "admin", "super_admin"])];
    const targetRolesJson = JSON.stringify(targetRoles);

    if (decision === "approved") {
      const notifications = await tx<{ id: string }[]>`
        insert into public.user_notifications
          (user_id, type, message, event_type, action_label, action_url, is_buzzer, role_target)
        select distinct ur.user_id, 'warning',
               ${`Approval requires manual action: ${incident.title}`},
               'ai_ceo_manual_action_required', 'Review', '/ai-ceo/approvals', true,
               array(select jsonb_array_elements_text(${targetRolesJson}::jsonb))
          from public.user_roles ur
         where ur.role::text in (select jsonb_array_elements_text(${targetRolesJson}::jsonb))
        returning id
      `;
      notified = notifications.length;
    }

    await tx`
      insert into public.audit_logs
        (occurred_at, actor, action, entity_type, entity_id, severity, metadata)
      values
        (now(), ${actorId}, ${decision === "approved" ? "ai_ceo_approval_manual_action_required" : "ai_ceo_incident_review_rejected"},
         'founder_incident', ${incident.id}, ${decision === "approved" ? "warning" : "info"},
         ${JSON.stringify({ title: incident.title, domain: incident.domain, targetRoles, notified })}::jsonb)
    `;
    return {
      ok: true,
      status: decision === "approved" ? "manual_action_required" : "rejected",
      notified,
    };
  });
}
