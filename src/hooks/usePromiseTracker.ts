import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { errorMessage, reportHealth } from "@/lib/promise-tracker/monitoring";
import type { Tables } from "@/integrations/supabase/types";
import type {
  PromiseAuditLogRow,
  PromiseCategoryRow,
  PromiseInsightRow,
  PromiseRow,
  PromiseRuleRow,
  PromiseSettingsRow,
  PromiseSubcategoryRow,
  PromiseWithCategory,
} from "@/lib/promise-tracker/constants";

export type PromiseHealthEventRow = Tables<"promise_health_events">;

/** The Promise Tracker console runs inside Software Vala's operator shell. */
export const TRACKER_ACTOR = "console@softwarevala.com";
export const TRACKER_ACTOR_ROLE = "Console Operator";

/** Why the database refused, in the words a person would use. */
const FAILURE_REASONS: Record<string, string> = {
  fine_system_disabled: "The fine system is switched off in Settings.",
  tip_system_disabled: "The tip system is switched off in Settings.",
  already_applied: "That rule has already been applied to this promise.",
  already_released: "That tip has already been released for this promise.",
  nothing_to_charge: "That rule produced no amount — a percentage rule needs a value to work from.",
  nothing_to_release: "That rule produced no amount — a percentage rule needs a value to work from.",
  no_such_rule: "That rule is no longer active.",
  no_such_promise: "That promise no longer exists.",
  not_a_fine_rule: "That is not a fine rule.",
  not_a_tip_rule: "That is not a tip rule.",
};

const PROMISE_SELECT = "*, promise_categories(id, slug, label, accent)";

export const trackerKeys = {
  promises: ["promise-tracker", "promises"] as const,
  categories: ["promise-tracker", "categories"] as const,
  subcategories: ["promise-tracker", "subcategories"] as const,
  rules: ["promise-tracker", "rules"] as const,
  insights: ["promise-tracker", "insights"] as const,
  logs: ["promise-tracker", "logs"] as const,
  settings: ["promise-tracker", "settings"] as const,
  health: ["promise-tracker", "health"] as const,
};

function monitoredQuery<T>(event: string, query: () => Promise<T>) {
  return async () => {
    try {
      return await query();
    } catch (error) {
      void reportHealth({ source: "query", event, message: errorMessage(error) });
      toast.error("Promise Tracker data failed to load", {
        id: `promise-tracker-query-${event}`,
        description: errorMessage(error),
      });
      throw error;
    }
  };
}

export function usePromises() {
  return useQuery({
    queryKey: trackerKeys.promises,
    queryFn: monitoredQuery("load_promises", async (): Promise<PromiseWithCategory[]> => {
      const { data, error } = await supabase
        .from("promises")
        .select(PROMISE_SELECT)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PromiseWithCategory[];
    }),
    refetchInterval: 30000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: trackerKeys.categories,
    queryFn: monitoredQuery("load_categories", async (): Promise<PromiseCategoryRow[]> => {
      const { data, error } = await supabase
        .from("promise_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    }),
  });
}

export function useSubcategories() {
  return useQuery({
    queryKey: trackerKeys.subcategories,
    queryFn: monitoredQuery("load_subcategories", async (): Promise<PromiseSubcategoryRow[]> => {
      const { data, error } = await supabase
        .from("promise_subcategories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    }),
  });
}

export function useRules() {
  return useQuery({
    queryKey: trackerKeys.rules,
    queryFn: monitoredQuery("load_rules", async (): Promise<PromiseRuleRow[]> => {
      const { data, error } = await supabase.from("promise_rules").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    }),
  });
}

export function useInsights() {
  return useQuery({
    queryKey: trackerKeys.insights,
    queryFn: monitoredQuery(
      "load_insights",
      async (): Promise<(PromiseInsightRow & { promises: PromiseWithCategory | null })[]> => {
        const { data, error } = await supabase
          .from("promise_ai_insights")
          .select("*, promises(*, promise_categories(id, slug, label, accent))")
          .order("delay_risk", { ascending: false });
        if (error) throw error;
        return (data ?? []) as (PromiseInsightRow & { promises: PromiseWithCategory | null })[];
      },
    ),
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: trackerKeys.logs,
    queryFn: monitoredQuery("load_audit_logs", async (): Promise<PromiseAuditLogRow[]> => {
      const { data, error } = await supabase
        .from("promise_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    }),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: trackerKeys.settings,
    queryFn: monitoredQuery("load_settings", async (): Promise<PromiseSettingsRow | null> => {
      const { data, error } = await supabase
        .from("promise_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    }),
  });
}

export function useHealthEvents(limit = 100) {
  return useQuery({
    queryKey: [...trackerKeys.health, limit],
    queryFn: monitoredQuery("load_health_events", async (): Promise<PromiseHealthEventRow[]> => {
      const { data, error } = await supabase
        .from("promise_health_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    }),
    refetchInterval: 60000,
  });
}

export async function writeAuditLog(entry: {
  action: string;
  promiseCode?: string | null;
  promiseId?: string | null;
  details: string;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  // The server decides who the actor is and what role they hold. The source
  // stamped every entry "Console Operator" whoever was signed in, which makes
  // the trail unable to answer the one question it exists for.
  const { error } = await supabase.rpc("pt_audit", {
    p_action: entry.action,
    p_promise_id: entry.promiseId ?? null,
    p_details: entry.details,
    p_old: entry.oldValue ?? null,
    p_new: entry.newValue ?? null,
  });
  if (error) {
    // Audit-log writes are compliance critical: surface the failure loudly.
    void reportHealth({
      source: "audit-log",
      event: entry.action,
      message: errorMessage(error),
      context: { promise_code: entry.promiseCode ?? null, details: entry.details },
    });
    toast.error("Audit log write failed", { description: errorMessage(error) });
    throw error;
  }
}

export function useLogAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeAuditLog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKeys.logs }),
  });
}

export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

/**
 * Live updates on promises, audit logs and health events with graceful
 * reconnection (exponential backoff), a user-visible status and monitoring.
 */
export function useTrackerRealtime() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [manualRetry, setManualRetry] = useState(0);
  const attemptRef = useRef(0);

  attemptRef.current = attempt;

  const retryNow = useCallback(() => {
    setAttempt(0);
    setStatus("connecting");
    setManualRetry((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const refetchAll = () => {
      queryClient.invalidateQueries({ queryKey: ["promise-tracker"] });
      setLastUpdate(new Date());
    };

    const scheduleReconnect = (reason: string) => {
      if (disposed) return;
      const current = attemptRef.current;
      const delay = RECONNECT_DELAYS_MS[Math.min(current, RECONNECT_DELAYS_MS.length - 1)]!;
      setStatus(current === 0 ? "reconnecting" : "offline");
      setLastError(reason);
      void reportHealth({
        source: "realtime",
        level: current >= 2 ? "error" : "warning",
        event: "subscription_lost",
        message: reason,
        context: { attempt: current + 1, retry_in_ms: delay },
      });
      reconnectTimer = setTimeout(() => {
        if (disposed) return;
        setAttempt(current + 1);
      }, delay);
    };

    const channel = supabase
      .channel(`promise-tracker-realtime-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "promises" }, () => {
        queryClient.invalidateQueries({ queryKey: trackerKeys.promises });
        queryClient.invalidateQueries({ queryKey: trackerKeys.insights });
        setLastUpdate(new Date());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "promise_audit_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: trackerKeys.logs });
        setLastUpdate(new Date());
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promise_health_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: trackerKeys.health });
        },
      )
      .subscribe((state, error) => {
        if (disposed) return;
        if (state === "SUBSCRIBED") {
          setStatus("live");
          setLastError(null);
          // A fresh subscription may have missed events while it was down.
          if (attemptRef.current > 0 || manualRetry > 0) refetchAll();
          setAttempt(0);
          return;
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          scheduleReconnect(
            error
              ? errorMessage(error)
              : `Realtime channel ${state.toLowerCase().replace("_", " ")}`,
          );
        }
      });

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, attempt, manualRetry]);

  return { lastUpdate, status, lastError, retryNow, attempt };
}

/** Ticking clock used for live countdowns. */
export function useTicker(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useTrackerMutation<TVariables>(
  handler: (variables: TVariables) => Promise<{ message: string; description?: string }>,
  event = "mutation",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: handler,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["promise-tracker"] });
      toast.success(result.message, { description: result.description });
    },
    onError: (error: Error) => {
      void reportHealth({ source: "mutation", event, message: errorMessage(error) });
      toast.error("Action failed", { description: error.message });
    },
  });
}

async function nextPromiseCode() {
  // Allocated by the database rather than by counting rows here. Two people
  // creating a promise in the same second used to receive the same code, and
  // the lexicographic ordering broke the sequence at PRM-100 regardless.
  const { data, error } = await supabase.rpc("pt_next_code");
  if (error) throw error;
  return String(data);
}

export type CreatePromiseInput = {
  title: string;
  description: string;
  categoryId: string;
  subCategory: string;
  nanoCategory: string;
  owner: string;
  receiver: string;
  deadline: string;
  priority: string;
  linkedModule: string;
  linkedRecordId?: string;
  status: "pending" | "active";
};

/**
 * Find the account behind a typed name.
 *
 * Owner and receiver stay free text - a promise can be made to a client who has
 * no login - but where the name or address does match somebody real, the
 * promise is tied to them so it reaches their dashboard and their record.
 */
async function resolveIdentity(nameOrEmail: string): Promise<string | null> {
  const needle = nameOrEmail.trim().toLowerCase();
  if (!needle) return null;
  const { data, error } = await supabase.rpc("pt_resolve_identity", { p_needle: needle });
  if (error) return null;
  return (data as string | null) ?? null;
}

export function useCreatePromise() {
  return useTrackerMutation(async (input: CreatePromiseInput) => {
    const code = await nextPromiseCode();

    const [{ data: auth }, settingsRow] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("promise_settings").select("require_approval").maybeSingle(),
    ]);
    const requiresApproval = settingsRow.data?.require_approval ?? false;

    const [ownerId, receiverId] = await Promise.all([
      resolveIdentity(input.owner),
      resolveIdentity(input.receiver),
    ]);

    // Section 6: with approval required, activating is a request rather than a
    // decision. Saving a draft is unaffected either way.
    const wantsActive = input.status === "active";
    const status = wantsActive && requiresApproval ? "pending_approval" : input.status;

    const { data: created, error } = await supabase
      .from("promises")
      .insert({
        code,
        title: input.title,
        description: input.description || null,
        category_id: input.categoryId,
        sub_category: input.subCategory || null,
        nano_category: input.nanoCategory || null,
        owner: input.owner,
        receiver: input.receiver,
        owner_user_id: ownerId,
        receiver_user_id: receiverId,
        deadline: input.deadline,
        priority: input.priority,
        status,
        linked_module: input.linkedModule || null,
        linked_record_id: input.linkedRecordId || null,
        approval_status: requiresApproval && wantsActive ? "pending" : "not_required",
        created_by: auth?.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAuditLog({
      action:
        status === "pending_approval"
          ? "Promise Created"
          : wantsActive
            ? "Promise Activated"
            : "Promise Created",
      promiseCode: code,
      promiseId: created?.id ?? null,
      details: `${input.title} — owner ${input.owner}, receiver ${input.receiver}`,
      newValue: status,
    });

    return {
      message:
        status === "pending_approval"
          ? "Promise sent for approval"
          : wantsActive
            ? "Promise activated"
            : "Promise saved as draft",
      description:
        status === "pending_approval"
          ? `${code} · waiting on an authorised approval`
          : `${code} · ${input.title}`,
    };
  }, "create_promise");
}

/**
 * Approve, or send back, a promise waiting on a decision.
 *
 * Section 6 and section 27: the approval is the authorised step, so it is a
 * database function that checks the caller rather than a status the screen
 * writes for itself.
 */
export function useApprovePromise() {
  return useTrackerMutation(
    async (input: { promise: PromiseRow; decision: "approved" | "rejected"; note?: string }) => {
      const { data, error } = await supabase.rpc("pt_decide_approval", {
        p_promise_id: input.promise.id,
        p_decision: input.decision,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) {
        throw new Error(
          result?.reason === "not_permitted"
            ? "Approving a promise needs manager or operator rights."
            : (result?.reason ?? "The decision was refused"),
        );
      }
      return {
        message: input.decision === "approved" ? "Promise approved" : "Promise sent back",
        description: input.promise.code,
      };
    },
    "decide_approval",
  );
}

export function useUpdatePromiseStatus() {
  return useTrackerMutation(
    async (input: { promise: PromiseRow; status: string; lock?: boolean }) => {
      if (input.promise.is_locked)
        throw new Error("Unlock this promise before changing its status.");
      const patch: Partial<PromiseRow> = { status: input.status };
      if (input.status === "fulfilled") {
        patch.fulfilled_at = new Date().toISOString();
        patch.is_locked = input.lock ?? true;
      }
      if (input.status === "broken") patch.breach_reason = "Deadline missed";
      const { error } = await supabase.from("promises").update(patch).eq("id", input.promise.id);
      if (error) throw error;
      await writeAuditLog({
        action: "Status Changed",
        promiseCode: input.promise.code,
        promiseId: input.promise.id,
        details: `Status changed from ${input.promise.status} to ${input.status}`,
      });
      return { message: "Status updated", description: `${input.promise.code} → ${input.status}` };
    },
    "update_status",
  );
}

export function useExtendDeadline() {
  return useTrackerMutation(async (input: { promise: PromiseRow; hours: number }) => {
    if (input.promise.is_locked)
      throw new Error("Unlock this promise before extending its deadline.");
    const newDeadline = new Date(
      new Date(input.promise.deadline).getTime() + input.hours * 3600000,
    ).toISOString();
    const { error } = await supabase
      .from("promises")
      .update({
        deadline: newDeadline,
        extended_count: input.promise.extended_count + 1,
        status: input.promise.status === "broken" ? "delayed" : input.promise.status,
      })
      .eq("id", input.promise.id);
    if (error) throw error;
    await writeAuditLog({
      action: "Deadline Extended",
      promiseCode: input.promise.code,
      promiseId: input.promise.id,
      details: `Deadline extended by ${input.hours} hours`,
    });
    return { message: "Deadline extended", description: `${input.promise.code} +${input.hours}h` };
  }, "extend_deadline");
}

export function useEscalatePromise() {
  return useTrackerMutation(async (input: { promise: PromiseRow; reason: string }) => {
    if (input.promise.is_locked) throw new Error("Unlock this promise before escalating it.");
    const level = Math.min(4, input.promise.escalation_level + 1);

    // pt_escalate writes the escalation record, notifies the audience the level
    // implies, audits it, and refuses to raise the same level twice. The source
    // set a number on the promise and did none of that.
    const { data, error } = await supabase.rpc("pt_escalate", {
      p_promise_id: input.promise.id,
      p_level: level,
      p_reason: input.reason,
      p_raised_by: "user",
    });
    if (error) throw error;
    const result = data as { ok?: boolean; reason?: string; label?: string; already_raised?: boolean } | null;
    if (!result?.ok) throw new Error(result?.reason ?? "Escalation was refused");
    if (result.already_raised) {
      return { message: `Level ${level} was already raised`, description: input.promise.code };
    }
    return {
      message: `Escalated to Level ${level}${result.label ? ` — ${result.label}` : ""}`,
      description: input.promise.code,
    };
  }, "escalate");
}

export function useResolveEscalation() {
  return useTrackerMutation(async (input: { promise: PromiseRow; status: string }) => {
    const { error } = await supabase
      .from("promises")
      .update({ escalation_status: input.status })
      .eq("id", input.promise.id);
    if (error) throw error;
    await writeAuditLog({
      action: "Escalation Updated",
      promiseCode: input.promise.code,
      promiseId: input.promise.id,
      details: `Escalation marked ${input.status}`,
    });
    return {
      message: "Escalation updated",
      description: `${input.promise.code} → ${input.status}`,
    };
  }, "resolve_escalation");
}

export function useApplyFine() {
  return useTrackerMutation(
    async (input: { promise: PromiseRow; ruleId: string; base?: number; note?: string }) => {
      // The amount is priced by the rule in the database. Letting the browser
      // send the figure meant the person being fined decided how much.
      const { data, error } = await supabase.rpc("pt_apply_fine", {
        p_promise_id: input.promise.id,
        p_rule_id: input.ruleId,
        p_note: input.note ?? null,
        p_basis: input.base ?? null,
        p_actor: "user",
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string; amount?: number; rule?: string } | null;
      if (!result?.ok) throw new Error(FAILURE_REASONS[result?.reason ?? ""] ?? result?.reason ?? "The fine was refused");
      return {
        message: "Fine applied",
        description: `${input.promise.code} · ${result.rule} · ${result.amount}`,
      };
    },
    "apply_fine",
  );
}

export function useReleaseTip() {
  return useTrackerMutation(
    async (input: { promise: PromiseRow; ruleId: string; base?: number; note?: string }) => {
      const { data, error } = await supabase.rpc("pt_release_tip", {
        p_promise_id: input.promise.id,
        p_rule_id: input.ruleId,
        p_note: input.note ?? null,
        p_basis: input.base ?? null,
        p_actor: "user",
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string; amount?: number; rule?: string } | null;
      if (!result?.ok) throw new Error(FAILURE_REASONS[result?.reason ?? ""] ?? result?.reason ?? "The tip was refused");
      return {
        message: "Tip released",
        description: `${input.promise.code} · ${result.rule} · ${result.amount}`,
      };
    },
    "release_tip",
  );
}

export function useToggleLock() {
  return useTrackerMutation(async (promiseRow: PromiseRow) => {
    const locked = !promiseRow.is_locked;
    const { error } = await supabase
      .from("promises")
      .update({ is_locked: locked })
      .eq("id", promiseRow.id);
    if (error) throw error;
    await writeAuditLog({
      action: locked ? "Promise Locked" : "Promise Unlocked",
      promiseCode: promiseRow.code,
      promiseId: promiseRow.id,
      details: locked ? "Record locked from further edits" : "Record unlocked for edits",
    });
    return {
      message: locked ? "Promise locked" : "Promise unlocked",
      description: promiseRow.code,
    };
  }, "toggle_lock");
}

export function useDeletePromise() {
  return useTrackerMutation(async (promiseRow: PromiseRow) => {
    if (promiseRow.is_locked) throw new Error("Unlock this promise before deleting it.");
    const { error } = await supabase.from("promises").delete().eq("id", promiseRow.id);
    if (error) throw error;
    await writeAuditLog({
      action: "Promise Deleted",
      promiseCode: promiseRow.code,
      promiseId: promiseRow.id,
      details: `${promiseRow.title} removed from the registry`,
    });
    return { message: "Promise deleted", description: promiseRow.code };
  }, "delete_promise");
}

export function useSaveRule() {
  return useTrackerMutation(
    async (input: {
      id?: string;
      code?: string;
      kind: "fine" | "tip";
      name: string;
      rule_type: string;
      amount: number;
      auto_apply: boolean;
      is_active: boolean;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("promise_rules")
          .update({
            name: input.name,
            rule_type: input.rule_type,
            amount: input.amount,
            auto_apply: input.auto_apply,
            is_active: input.is_active,
          })
          .eq("id", input.id);
        if (error) throw error;
        await writeAuditLog({
          action: "Rule Updated",
          details: `${input.name} updated (${input.kind})`,
        });
        return { message: "Rule updated", description: input.name };
      }

      const prefix = input.kind === "fine" ? "FR" : "TR";
      const { data: existing, error: listError } = await supabase
        .from("promise_rules")
        .select("code")
        .eq("kind", input.kind)
        .order("code", { ascending: false })
        .limit(1);
      if (listError) throw listError;
      const next = Number(existing?.[0]?.code?.split("-")[1] ?? 0) + 1;
      const { error } = await supabase.from("promise_rules").insert({
        code: `${prefix}-${String(next).padStart(3, "0")}`,
        kind: input.kind,
        name: input.name,
        rule_type: input.rule_type,
        amount: input.amount,
        auto_apply: input.auto_apply,
        is_active: input.is_active,
      });
      if (error) throw error;
      await writeAuditLog({
        action: "Rule Created",
        details: `${input.name} created (${input.kind})`,
      });
      return { message: "Rule created", description: input.name };
    },
    "save_rule",
  );
}

export function useDeleteRule() {
  return useTrackerMutation(async (rule: PromiseRuleRow) => {
    const { error } = await supabase.from("promise_rules").delete().eq("id", rule.id);
    if (error) throw error;
    await writeAuditLog({ action: "Rule Deleted", details: `${rule.name} removed` });
    return { message: "Rule deleted", description: rule.name };
  }, "delete_rule");
}

export function useSaveSettings() {
  return useTrackerMutation(
    async (input: { id: string; patch: Partial<PromiseSettingsRow>; label?: string }) => {
      const { error } = await supabase
        .from("promise_settings")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
      await writeAuditLog({
        action: "Settings Updated",
        details: input.label ?? "Promise tracker settings updated",
      });
      return { message: "Settings saved", description: "Promise tracker settings updated" };
    },
    "save_settings",
  );
}

export function useSaveCategory() {
  return useTrackerMutation(
    async (input: { id?: string; slug: string; label: string; accent: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("promise_categories")
          .update({ label: input.label, accent: input.accent })
          .eq("id", input.id);
        if (error) throw error;
        await writeAuditLog({ action: "Category Updated", details: `${input.label} updated` });
        return { message: "Category updated", description: input.label };
      }
      const { error } = await supabase
        .from("promise_categories")
        .insert({ slug: input.slug, label: input.label, accent: input.accent });
      if (error) throw error;
      await writeAuditLog({ action: "Category Created", details: `${input.label} created` });
      return { message: "Category created", description: input.label };
    },
    "save_category",
  );
}

export function useSaveSubcategory() {
  return useTrackerMutation(
    async (input: { id?: string; categoryId: string; slug: string; label: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("promise_subcategories")
          .update({ label: input.label, category_id: input.categoryId })
          .eq("id", input.id);
        if (error) throw error;
        await writeAuditLog({ action: "Sub Category Updated", details: `${input.label} updated` });
        return { message: "Sub category updated", description: input.label };
      }
      const { error } = await supabase
        .from("promise_subcategories")
        .insert({ category_id: input.categoryId, slug: input.slug, label: input.label });
      if (error) throw error;
      await writeAuditLog({ action: "Sub Category Created", details: `${input.label} created` });
      return { message: "Sub category created", description: input.label };
    },
    "save_subcategory",
  );
}

/**
 * Records that an operator accepted an AI suggestion. AI stays assist-only:
 * applying only writes the decision to the audit trail — no automatic
 * status change or escalation is executed on the operator's behalf.
 */
export function useApplyInsight() {
  return useTrackerMutation(
    async (input: { insight: PromiseInsightRow; promise: PromiseWithCategory }) => {
      // The source logged "accepted" and did nothing. Section 21 wants a real,
      // defined, authorised action; pt_apply_insight performs one of three -
      // remind the owner, tell the manager, or raise the next escalation - and
      // never touches money or anything irreversible.
      const { data, error } = await supabase.rpc("pt_apply_insight", {
        p_insight_id: input.insight.id,
        p_action: null,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string; action?: string } | null;
      if (!result?.ok) {
        throw new Error(
          result?.reason === "not_permitted"
            ? "Applying a suggestion needs manager or operator rights."
            : result?.reason === "already_actioned"
              ? "That suggestion has already been acted on."
              : (result?.reason ?? "The suggestion could not be applied"),
        );
      }
      const done: Record<string, string> = {
        send_reminder: "Reminder sent to the owner",
        notify_manager: "Manager notified",
        raise_escalation: "Escalation raised",
      };
      return {
        message: done[result.action ?? ""] ?? "Suggestion applied",
        description: input.promise.code,
      };
    },
    "apply_insight",
  );
}

export function useDismissInsight() {
  return useTrackerMutation(
    async (input: { insight: PromiseInsightRow; promise: PromiseWithCategory | null }) => {
      // Dismissed rather than deleted: section 21 wants the dismissal on the
      // record, and the source removed the row so nobody could later ask who
      // waved it away.
      const { data, error } = await supabase.rpc("pt_dismiss_insight", {
        p_insight_id: input.insight.id,
        p_reason: input.insight.suggested_action,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) {
        throw new Error(
          result?.reason === "not_permitted"
            ? "Dismissing a suggestion needs manager or operator rights."
            : (result?.reason ?? "The suggestion could not be dismissed"),
        );
      }
      return {
        message: "Suggestion dismissed",
        description: input.promise?.code ?? "recorded in the audit log",
      };
    },
    "dismiss_insight",
  );
}

export function useTrackerMetrics() {
  const { data: promises = [], isLoading } = usePromises();

  const metrics = useMemo(() => {
    const now = Date.now();
    const byStatus = (status: string) => promises.filter((p) => p.status === status);
    const overdue = promises.filter(
      (p) => !["fulfilled"].includes(p.status) && new Date(p.deadline).getTime() < now,
    );
    const fulfilled = byStatus("fulfilled");
    const onTime = fulfilled.filter(
      (p) => p.fulfilled_at && new Date(p.fulfilled_at) <= new Date(p.deadline),
    );
    return {
      total: promises.length,
      active: byStatus("active").length,
      pending: byStatus("pending").length,
      delayed: byStatus("delayed").length,
      broken: byStatus("broken").length,
      fulfilled: fulfilled.length,
      escalated: promises.filter((p) => p.escalation_level > 0 && p.status !== "fulfilled").length,
      overdue: overdue.length,
      totalFines: promises.reduce((sum, p) => sum + Number(p.fine_amount), 0),
      totalTips: promises.reduce((sum, p) => sum + Number(p.tip_amount), 0),
      onTimeRate: fulfilled.length ? Math.round((onTime.length / fulfilled.length) * 100) : 0,
    };
  }, [promises]);

  return { metrics, promises, isLoading };
}

/**
 * Ask the configured AI provider to assess the open register.
 *
 * Advisory only: it writes insight rows and changes no promise. Where no
 * provider is configured in AI API Manager the server says so, and that reason
 * is shown rather than an empty board that implies there is no risk.
 */
export function useGenerateInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { limit?: number }) => {
      const { generatePromiseInsights } = await import("@/lib/promise-tracker/insights.functions");
      return generatePromiseInsights({ data: { limit: input.limit ?? 10 } });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: trackerKeys.insights });
      void queryClient.invalidateQueries({ queryKey: trackerKeys.logs });
      const generated = (result as { generated?: number; message?: string }).generated ?? 0;
      const note = (result as { message?: string }).message;
      toast.success(
        generated > 0 ? `${generated} insight(s) generated` : "Nothing new to assess",
        { description: note },
      );
    },
    onError: (error: Error) => {
      void reportHealth({ source: "mutation", event: "generate_insights", message: error.message });
      toast.error("Could not assess the register", { description: error.message });
    },
  });
}
