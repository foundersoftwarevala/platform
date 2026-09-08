import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Loader2 } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton } from "../ui";
import type { ActionConfig, Visibility } from "@/lib/marketplace/action-layer";

/**
 * Product Action Manager — the action layer, now actually a layer.
 *
 * The screen listed ten actions with a switch beside each. Every switch was
 * hardcoded on and none was wired to anything, so turning Buy Now off changed
 * nothing anywhere. The description promised enable, disable, reorder and
 * theme; none of the four did anything.
 *
 * All four work now, against one registry stored in system_settings and read
 * by one resolver. Each row also shows whether the action can actually execute
 * today and, when it cannot, why - a Buy Now with no payment provider says so
 * rather than sitting there looking active.
 */

type Health = {
  key: string; enabled: boolean; visibility: string; state: string;
  blocked_reason: string | null; applies_to_products: number | null; note: string | null;
};

type Data = {
  ok: boolean; configured: boolean; source: string;
  actions: ActionConfig[];
  environment: { paymentConfigured: boolean; products_visible: number; products_with_demo: number };
  health: Health[];
};

const VISIBILITIES: Visibility[] = ["VISIBLE", "CONDITIONAL", "DISABLED", "HIDDEN"];

const STATE_TONE: Record<string, string> = {
  OK: "bg-emerald-500/10 text-emerald-500",
  BLOCKED: "bg-rose-500/10 text-rose-500",
  OFF: "bg-muted text-muted-foreground",
};

export function ActionLayer() {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<ActionConfig[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/actions/registry", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to configure the action layer."
          : "Could not read the action layer.")));
        return;
      }
      setData(payload as Data);
      setDraft((payload as Data).actions);
    } catch {
      setError(new Error("Could not reach the server."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const change = (key: string, patch: Partial<ActionConfig>) =>
    setDraft((d) => d?.map((a) => (a.key === key ? { ...a, ...patch } : a)) ?? d);

  const move = (index: number, by: number) =>
    setDraft((d) => {
      if (!d) return d;
      const next = [...d].sort((a, b) => a.sort_order - b.sort_order);
      const to = index + by;
      if (to < 0 || to >= next.length) return d;
      [next[index], next[to]] = [next[to], next[index]];
      return next.map((a, i) => ({ ...a, sort_order: i + 1 }));
    });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setNote(null);
    try {
      const response = await fetch("/api/actions/registry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ actions: draft, reason: "Configured from the Product Action Manager." }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote(payload?.error ?? "That configuration was not saved.");
        return;
      }
      setNote("Saved. The change is recorded in the audit trail.");
      await load();
    } catch {
      setNote("Could not reach the server. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    draft && data && JSON.stringify(draft) !== JSON.stringify(data.actions);
  const ordered = [...(draft ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const healthOf = (key: string) => data?.health.find((h) => h.key === key);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Action Manager"
        title="Action layer"
        description="Enable, disable, reorder and theme every action available on product cards and detail pages."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
              Vala AI
            </PillButton>
            <PillButton variant="primary" onClick={() => void save()}>
              <span className="inline-flex items-center gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {dirty ? "Save changes" : "Saved"}
              </span>
            </PillButton>
          </>
        }
      />

      {error ? <LoadFailure error={error} what="the action layer" onRetry={() => void load()} /> : null}

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      {data && !data.environment.paymentConfigured && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No payment provider is configured, so Buy Now and Add to Cart cannot complete for any product.
            They are reported BLOCKED below rather than shown as working.
          </span>
        </div>
      )}

      {!data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the registry…
        </div>
      ) : (
        <>
          <div className="mb-3 text-[11px] text-muted-foreground">
            Configuration source: {data.source} · {data.environment.products_visible} visible products,
            {" "}{data.environment.products_with_demo} with a demo URL.
          </div>

          <div className="space-y-2">
            {ordered.map((a, i) => {
              const h = healthOf(a.key);
              return (
                <div key={a.key} className="glass rounded-xl p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex shrink-0 flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                        className="rounded border border-border px-1 disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === ordered.length - 1} aria-label="Move down"
                        className="mt-0.5 rounded border border-border px-1 disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="min-w-[150px] flex-1">
                      <div className="text-sm font-semibold">{a.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{a.key}</div>
                    </div>

                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATE_TONE[h?.state ?? "OFF"]}`}>
                      {h?.state ?? "—"}
                    </span>

                    <select
                      value={a.visibility}
                      onChange={(e) => change(a.key, { visibility: e.target.value as Visibility })}
                      aria-label={`${a.label} visibility`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {VISIBILITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>

                    <select
                      value={a.variant}
                      onChange={(e) => change(a.key, { variant: e.target.value as ActionConfig["variant"] })}
                      aria-label={`${a.label} style`}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {["primary", "outline", "ghost"].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>

                    <button
                      role="switch"
                      aria-checked={a.enabled}
                      aria-label={`${a.label} enabled`}
                      onClick={() => change(a.key, { enabled: !a.enabled })}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${a.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${a.enabled ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>

                  {(h?.blocked_reason || h?.note) && (
                    <div className="mt-1.5 pl-8 text-[10px] text-muted-foreground">
                      {h?.blocked_reason ? <span className="text-rose-500">{h.blocked_reason} </span> : null}
                      {h?.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Card className="mt-4">
            <div className="mb-1 text-sm font-bold">How this reaches the storefront</div>
            <p className="text-[11px] text-muted-foreground">
              The registry is stored in <span className="font-mono">system_settings</span> under one key, and
              <span className="font-mono"> resolveProductActions()</span> in
              <span className="font-mono"> lib/marketplace/action-layer.ts</span> is the single function that
              decides what a surface may render. Product cards on the home page still draw their own action set
              and have not been moved onto the resolver yet — that is the remaining wiring, and it is stated
              here rather than implied by a switch that looks connected.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
