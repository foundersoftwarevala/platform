import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bookmark, Check, Eye, History, Loader2, PlayCircle,
  RotateCcw, Search, Share2, ShoppingBag, Zap,
} from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * Storefront Micro-Interactions, connected.
 *
 * The same eight cards, the same labels, the same four surface chips. What
 * changed: the switches read and write a stored configuration, the chips are
 * the surfaces that were saved rather than four decorations printed on every
 * card, and Save Configuration saves.
 *
 * Each card also says what stands between it and actually working, because two
 * of the eight cannot work here and pretending otherwise is the failure mode
 * this whole screen was in before. Quick Buy has no payment provider that
 * authenticates. Save For Later has no saved-products table, so it is the
 * visitor's own browser and nothing more.
 *
 * The static original is kept as MicroFeaturesSectionStatic.
 */

type Supports = {
  surfaces: boolean; frequency: boolean; animation: boolean;
  device: boolean; audience: boolean; count: boolean;
};

type Definition = {
  key: string; label: string; description: string;
  supports: Supports; requiresAction: string | null; storage: string;
};

type Config = {
  key: string; enabled: boolean; surfaces: string[]; frequency: string;
  animation: boolean; animation_ms: number;
  desktop: boolean; mobile: boolean; anonymous: boolean; authenticated: boolean;
  count: number;
};

type Readiness = {
  key: string;
  action: { key: string; label: string; enabled: boolean; visibility: string } | null;
  ready: boolean; blockers: string[];
};

type Version = {
  action: string; reason: string | null; actor: string; actor_role: string; created_at: string;
};

type Data = {
  ok: boolean; configured: boolean; source: string;
  definitions: Definition[];
  surfaces: { id: string; label: string }[];
  frequencies: { id: string; label: string }[];
  config: Record<string, Config>;
  readiness: Readiness[];
  analytics: {
    total_events: number; unique_sessions: number; unique_users: number;
    by_action: Record<string, number>; by_surface: Record<string, number>;
    shares_recorded: number; cart_items: number; empty: boolean; note: string;
  };
  versions: Version[];
  permissions: { view: boolean; edit: boolean; manage: boolean };
  tenancy: { model: string; note: string };
};

const ICONS: Record<string, typeof Eye> = {
  continue_browsing: History, recently_viewed: Eye, save_for_later: Bookmark,
  quick_preview: PlayCircle, quick_buy: Zap, quick_demo: PlayCircle,
  one_click_share: Share2, add_to_cart_burst: ShoppingBag,
};

const when = (v: string) =>
  new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function MicroInteractions() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<Record<string, Config>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ key: string; field: string; reason: string }[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/micro-interactions", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The configuration could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
      setDraft(structuredClone((payload as Data).config));
      setIssues([]);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(
    () => Boolean(data) && JSON.stringify(draft) !== JSON.stringify(data?.config ?? {}),
    [draft, data],
  );

  const update = useCallback((key: string, patch: Partial<Config>) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setNote(null);
  }, []);

  const toggleSurface = useCallback((key: string, surface: string) => {
    setDraft((current) => {
      const list = current[key].surfaces;
      const next = list.includes(surface) ? list.filter((s) => s !== surface) : [...list, surface];
      return { ...current, [key]: { ...current[key], surfaces: next } };
    });
    setNote(null);
  }, []);

  const persist = useCallback(async (payload: object, describe: string) => {
    setBusy(true);
    setNote(null);
    setIssues([]);
    try {
      const response = await fetch("/api/marketplace/micro-interactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        // Section 2 and 26: no success is shown that the database did not give.
        if (Array.isArray(body.issues)) setIssues(body.issues);
        setNote(body?.message ?? body?.error ?? `${describe} was refused (${response.status}).`);
        return false;
      }
      setNote(
        body.reset
          ? "Every micro-interaction is back on the Software Vala defaults."
          : `Saved. ${body.changed?.length ? `Changed: ${body.changed.join(", ")}.` : "Nothing differed."}`,
      );
      await load();
      return true;
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : `${describe} did not reach the server.`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.definitions;
    return data.definitions.filter(
      (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.key.includes(q),
    );
  }, [data, query]);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Micro-Features" title="Storefront Micro-Interactions" description="The small, premium touches that make the marketplace feel alive — toggle per surface." />
        <LoadFailure error={error} onRetry={load} what="the micro-interaction configuration" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Micro-Features" title="Storefront Micro-Interactions" description="The small, premium touches that make the marketplace feel alive — toggle per surface." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the stored configuration…</div></Card>
      </div>
    );
  }

  const canEdit = data.permissions.manage;
  const enabledCount = Object.values(draft).filter((c) => c.enabled).length;
  const readyCount = data.readiness.filter((r) => r.ready).length;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Micro-Features"
        title="Storefront Micro-Interactions"
        description="The small, premium touches that make the marketplace feel alive — toggle per surface."
        actions={
          canEdit ? (
            <>
              <PillButton onClick={() => void persist({ reset: true }, "The reset")} disabled={busy}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </PillButton>
              <PillButton
                variant="primary"
                disabled={busy || !dirty}
                onClick={() => void persist({ config: draft }, "That configuration")}
              >
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Save Configuration
              </PillButton>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Your role can see this configuration but not change it.</span>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Switched on" value={`${enabledCount} of ${data.definitions.length}`} />
        <StatCard label="Able to run" value={`${readyCount} of ${data.definitions.length}`} tone={readyCount === data.definitions.length ? "success" : "warning"} />
        <StatCard label="Interaction events" value={String(data.analytics.total_events)} tone="premium" />
        <StatCard label="Sessions seen" value={String(data.analytics.unique_sessions)} />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a micro-interaction"
              aria-label="Search micro-interactions"
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
          {canEdit ? (
            <>
              <PillButton onClick={() => setDraft((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, enabled: true }])))}>
                Enable all
              </PillButton>
              <PillButton onClick={() => setDraft((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, enabled: false }])))}>
                Disable all
              </PillButton>
            </>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {data.source}{dirty ? " · unsaved changes" : ""}
          </span>
        </div>
      </Card>

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      {issues.length ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="text-sm">
              <div className="font-medium">Nothing was saved. These values were refused:</div>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {issues.map((i, index) => (
                  <li key={index}><span className="text-foreground">{i.key} · {i.field}</span> — {i.reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((definition) => {
          const config = draft[definition.key];
          const ready = data.readiness.find((r) => r.key === definition.key);
          const Icon = ICONS[definition.key] ?? Zap;
          if (!config) return null;
          return (
            <Card key={definition.key}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 text-accent ring-1 ring-accent/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{definition.label}</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{definition.description}</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={config.enabled}
                  aria-label={`${config.enabled ? "Disable" : "Enable"} ${definition.label}`}
                  disabled={!canEdit}
                  onClick={() => update(definition.key, { enabled: !config.enabled })}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${config.enabled ? "border-accent/50 bg-accent/70" : "border-border bg-muted"} ${canEdit ? "" : "opacity-60"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${config.enabled ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.surfaces.map((s) => {
                  const on = config.surfaces.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      disabled={!canEdit}
                      onClick={() => toggleSurface(definition.key, s.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${on ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-background/40 text-muted-foreground"}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-2 text-[11px]">
                {definition.supports.frequency ? (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Frequency</span>
                    <select
                      value={config.frequency}
                      disabled={!canEdit}
                      onChange={(e) => update(definition.key, { frequency: e.target.value })}
                      className="rounded border border-border bg-background px-1.5 py-1"
                    >
                      {data.frequencies.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </label>
                ) : null}

                {definition.supports.count ? (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Products kept</span>
                    <input
                      type="number" min={1} max={60} value={config.count} disabled={!canEdit}
                      onChange={(e) => update(definition.key, { count: Number(e.target.value) })}
                      className="w-16 rounded border border-border bg-background px-1.5 py-1"
                    />
                  </label>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {(["desktop", "mobile", "anonymous", "authenticated"] as const).map((flag) => (
                    <button
                      key={flag}
                      disabled={!canEdit}
                      aria-pressed={config[flag]}
                      onClick={() => update(definition.key, { [flag]: !config[flag] } as Partial<Config>)}
                      className={`rounded border px-1.5 py-0.5 ${config[flag] ? "border-emerald-500/40 text-emerald-500" : "border-border text-muted-foreground line-through"}`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>

                {definition.supports.animation ? (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Animation</span>
                    <span className="flex items-center gap-1">
                      <input
                        type="checkbox" checked={config.animation} disabled={!canEdit}
                        onChange={(e) => update(definition.key, { animation: e.target.checked })}
                        aria-label={`Animate ${definition.label}`}
                      />
                      <input
                        type="number" min={80} max={2000} step={20} value={config.animation_ms} disabled={!canEdit || !config.animation}
                        onChange={(e) => update(definition.key, { animation_ms: Number(e.target.value) })}
                        aria-label={`${definition.label} animation duration in milliseconds`}
                        className="w-16 rounded border border-border bg-background px-1.5 py-1"
                      />
                      <span className="text-muted-foreground">ms</span>
                    </span>
                  </label>
                ) : null}
              </div>

              <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                <div>{definition.storage}</div>
                {ready?.action ? (
                  <div className="mt-1">
                    Action Layer: {ready.action.label} — {ready.action.enabled ? ready.action.visibility.toLowerCase() : "turned off"}
                  </div>
                ) : null}
                {ready && !ready.ready ? (
                  <div className="mt-1 flex items-start gap-1 text-amber-500">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{ready.blockers.join(" ")}</span>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1 text-emerald-500">
                    <Check className="h-3 w-3" /> Everything it needs is in place.
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Usage — {data.analytics.note}
          </div>
          {data.analytics.empty ? (
            <p className="text-sm text-muted-foreground">No data available.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {Object.entries(data.analytics.by_action).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                  <span className="text-muted-foreground">{k}</span><span>{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>shares recorded</span><span>{data.analytics.shares_recorded}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>cart items</span><span>{data.analytics.cart_items}</span>
              </div>
              {Object.keys(data.analytics.by_surface).length === 0 ? (
                <p className="pt-2 text-[11px] text-amber-500">
                  No event carries a surface. The tracking endpoint accepts one and stores it; nothing on the
                  storefront sends it yet, so per-surface usage cannot be reported.
                </p>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration history
          </div>
          {data.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been changed yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.versions.map((v, i) => (
                <div key={i} className="border-b border-border/40 pb-1">
                  <div className="flex justify-between gap-2">
                    <span>{v.action}</span>
                    <span className="text-xs text-muted-foreground">{when(v.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{v.actor} ({v.actor_role}) — {v.reason ?? "no reason given"}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{data.tenancy.note}</p>
        </Card>
      </div>
    </div>
  );
}
