import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Loader2, RefreshCw } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import type { ActionConfig, Visibility } from "@/lib/marketplace/action-layer";
import { Card, PageHeader, PillButton } from "../ui";

type Health = {
  key: string;
  state: string;
  blocked_reason: string | null;
  applies_to_products: number | null;
  note: string | null;
};

type Registry = {
  ok: boolean;
  configured: boolean;
  source: string;
  actions: ActionConfig[];
  environment: { paymentConfigured: boolean; products_visible: number; products_with_demo: number };
  health: Health[];
};

const VISIBILITIES: Visibility[] = ["VISIBLE", "CONDITIONAL", "DISABLED", "HIDDEN"];
const STATE_TONE: Record<string, string> = {
  OK: "bg-emerald-500/10 text-emerald-600",
  BLOCKED: "bg-rose-500/10 text-rose-600",
  OFF: "bg-muted text-muted-foreground",
};

export function ActionLayer() {
  const [data, setData] = useState<Registry | null>(null);
  const [draft, setDraft] = useState<ActionConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/actions/registry", { headers: await authHeaders() });
      const result = (await response.json().catch(() => ({}))) as Registry & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not read the VPS action registry.");
      setData(result);
      setDraft(result.actions);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not read the VPS action registry.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (key: string, patch: Partial<ActionConfig>) =>
    setDraft(
      (current) =>
        current?.map((action) => (action.key === key ? { ...action, ...patch } : action)) ?? null,
    );

  const move = (index: number, by: number) =>
    setDraft((current) => {
      if (!current) return null;
      const next = [...current].sort((a, b) => a.sort_order - b.sort_order);
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((action, i) => ({ ...action, sort_order: i + 1 }));
    });

  const save = async () => {
    if (!draft || !dirty || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/actions/registry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          actions: draft,
          reason: "Configured from the Product Action Manager.",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The VPS action settings were not saved.");
      setMessage("Saved to VPS Postgres and recorded in the audit log.");
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The settings were not saved.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(data.actions));
  const ordered = [...(draft ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const healthFor = (key: string) => data?.health.find((item) => item.key === key);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Action Manager"
        title="Action layer"
        description="Configure product actions stored in VPS Postgres. Changes are audited in the same transaction."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => void load()} disabled={saving}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </PillButton>
            <PillButton
              variant="primary"
              onClick={() => void save()}
              disabled={!dirty || saving || !data}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </PillButton>
          </>
        }
      />

      {error && (
        <Card className="mb-4">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </Card>
      )}
      {message && (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the VPS registry…
        </div>
      )}
      {data && (
        <>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Source: {data.source} · {data.environment.products_visible} visible products ·{" "}
            {data.environment.products_with_demo} with demo URLs
            {!data.configured ? " · Defaults are not yet saved." : ""}
          </p>
          <div className="space-y-2">
            {ordered.map((action, index) => {
              const health = healthFor(action.key);
              return (
                <Card key={action.key}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${action.label} up`}
                        className="rounded border border-border px-1 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === ordered.length - 1}
                        aria-label={`Move ${action.label} down`}
                        className="mt-0.5 rounded border border-border px-1 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="min-w-[150px] flex-1">
                      <div className="text-sm font-semibold">{action.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {action.key}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_TONE[health?.state ?? "OFF"] ?? STATE_TONE.OFF}`}
                    >
                      {health?.state ?? "—"}
                    </span>
                    <select
                      value={action.visibility}
                      onChange={(event) =>
                        change(action.key, { visibility: event.target.value as Visibility })
                      }
                      aria-label={`${action.label} visibility`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {VISIBILITIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      value={action.variant}
                      onChange={(event) =>
                        change(action.key, {
                          variant: event.target.value as ActionConfig["variant"],
                        })
                      }
                      aria-label={`${action.label} style`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {(["primary", "outline", "ghost"] as const).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={action.enabled}
                      aria-label={`${action.label} enabled`}
                      onClick={() => change(action.key, { enabled: !action.enabled })}
                      className={`relative h-5 w-9 rounded-full ${action.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${action.enabled ? "left-[18px]" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                  {(health?.blocked_reason || health?.note) && (
                    <p className="mt-2 pl-8 text-[10px] text-muted-foreground">
                      {health.blocked_reason ? (
                        <span className="text-rose-500">{health.blocked_reason} </span>
                      ) : null}
                      {health.note}
                    </p>
                  )}
                  {health?.applies_to_products != null && (
                    <p className="mt-1 pl-8 text-[10px] text-muted-foreground">
                      Applies to {health.applies_to_products.toLocaleString()} product(s)
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
