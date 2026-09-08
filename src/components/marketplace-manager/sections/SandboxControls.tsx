import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Copy, KeyRound, Lock, RefreshCw, Search, ShieldAlert,
  Timer, Trash2,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  extendSandbox, getSandboxes, resetSandbox, rotateSandboxCredential,
  runSandboxCleanup, runSandboxExpiry, setSandboxSettings,
  type Capability, type SandboxRow, type SandboxView,
} from "@/lib/marketplace-manager/sandbox.functions";

/**
 * Demo Sandbox Controls — the screen that already existed, now connected.
 *
 * It showed "42 active sandboxes, 3 resetting, 7 expiring, 18 cleanups today"
 * and a reset policy of "6 hours" typed into a text box. None of it came from
 * anywhere, and there was no sandbox record behind any of it.
 *
 * The honest position, which this screen states rather than hides: there is no
 * deployment runtime, so no sandbox container, schema or tenant is ever created.
 * Section 4 forbids claiming isolation that has not been implemented, so
 * isolation reports NOT_IMPLEMENTED and a database reset, an uploads reset and
 * an infrastructure cleanup are recorded as blocked jobs rather than successes.
 *
 * What is real is real: the sandbox lifecycle, activity tracking that drives
 * idle expiry, credential generation and rotation with only bcrypt hashes
 * stored, the job lock that stops two resets racing, the expiry engine and a
 * cleanup that preserves product, audit, legal and deployment history.
 */

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  provisioning: "bg-sky-500/10 text-sky-500",
  resetting: "bg-amber-500/10 text-amber-500",
  expiring: "bg-amber-500/10 text-amber-500",
  disabled: "bg-muted text-muted-foreground",
  expired: "bg-rose-500/10 text-rose-500",
  cleanup_pending: "bg-amber-500/10 text-amber-500",
  cleaned: "bg-muted text-muted-foreground",
  failed: "bg-rose-500/10 text-rose-500",
};

const CAP_TONE: Record<string, string> = {
  CONNECTED: "text-emerald-500",
  PARTIALLY_CONNECTED: "text-amber-600",
  BLOCKED: "text-rose-500",
  NOT_IMPLEMENTED: "text-rose-500",
};

const label = (s: string) => s.replace(/_/g, " ");
const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function SandboxControls() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState<string | null>(null);
  // Held in memory only, shown once, never persisted anywhere.
  const [revealed, setRevealed] = useState<
    { sandbox: string; role: string; username: string; password: string } | null
  >(null);

  const q = useQuery({
    queryKey: ["marketplace", "sandboxes", search, status],
    queryFn: () => getSandboxes({ data: { search: search || undefined, status: status || undefined } }),
    staleTime: 10_000,
  });
  const d = q.data as SandboxView | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "sandboxes"] });
  };

  const reset = useMutation({
    mutationFn: (v: { id: string }) => resetSandbox({ data: { id: v.id, trigger: "manual" } }),
    onSuccess: (res) => {
      setNote(res.message ?? (res.ok ? "Reset complete." : `Reset ${res.outcome}.`));
      void qc.invalidateQueries({ queryKey: ["marketplace", "sandboxes"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const rotate = useMutation({
    mutationFn: (v: { id: string; role: "demo_user" | "demo_admin"; ref: string }) =>
      rotateSandboxCredential({ data: { id: v.id, role: v.role } }).then((r) => ({ ...r, ref: v.ref, role: v.role })),
    onSuccess: (res) => {
      if (res.ok && res.password) {
        setRevealed({
          sandbox: res.ref, role: res.role,
          username: res.username ?? "", password: res.password,
        });
        setNote(res.note ?? null);
      } else {
        setNote(res.message ?? `That did not work (${res.reason})`);
      }
      void qc.invalidateQueries({ queryKey: ["marketplace", "sandboxes"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const extend = useMutation({
    mutationFn: (v: { id: string; hours: number }) => extendSandbox({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const expiry = useMutation({
    mutationFn: () => runSandboxExpiry(),
    onSuccess: (res) => {
      setNote(res.ok
        ? `${res.warned ?? 0} warning(s), ${res.entered_expiring ?? 0} now expiring, ${res.expired ?? 0} expired. ${res.note ?? ""}`
        : `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "sandboxes"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const cleanup = useMutation({
    mutationFn: () => runSandboxCleanup(),
    onSuccess: (res) => {
      const r = res.removed ?? {};
      setNote(res.ok
        ? `Cleanup ${res.status}: ${r.session_rows ?? 0} session row(s), ${r.abandoned_jobs ?? 0} abandoned job(s), ${r.credentials_expired ?? 0} credential(s) expired, ${r.sandboxes_marked_cleaned ?? 0} sandbox(es) cleaned. Products, audit and deployment history untouched.`
        : `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "sandboxes"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const settings = useMutation({
    mutationFn: (v: Parameters<typeof setSandboxSettings>[0]["data"]) => setSandboxSettings({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · Demo Sandbox" title="Demo Sandbox Controls" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const s = d?.settings;
  const caps = (d?.capabilities ?? {}) as Record<string, Capability>;
  const rows = d?.sandboxes ?? [];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Demo Sandbox"
        title="Demo Sandbox Controls"
        description="Every product demo runs inside a sandbox. Manage expiry, resets, demo credentials and automated cleanup."
        actions={
          <>
            <button
              // Advisory by construction: every destructive sandbox operation
              // sits behind an operator-guarded RPC the assistant cannot call.
              onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Vala AI
            </button>
            <button
              onClick={() => expiry.mutate()}
              disabled={expiry.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Timer className="h-3.5 w-3.5" />
              {expiry.isPending ? "Running…" : "Expiry sweep"}
            </button>
            <button
              onClick={() => cleanup.mutate()}
              disabled={cleanup.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {cleanup.isPending ? "Cleaning…" : "Run cleanup"}
            </button>
          </>
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      {/* --------------------------------------------------- capabilities */}
      <Card className="mb-4 border-amber-500/40">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <ShieldAlert className="h-4 w-4 text-amber-600" /> What this system can actually do
        </h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Split deliberately. Some of this is real regardless of infrastructure; the rest needs a
          deployment runtime that does not exist. Reporting them together would hide which is which.
        </p>
        <div className="grid gap-1.5 md:grid-cols-2">
          {Object.entries(caps)
            .filter(([, v]) => v && typeof v === "object" && "state" in v)
            .map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border/60 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold capitalize">{label(k)}</span>
                  <span className={`ml-auto text-[11px] font-semibold ${CAP_TONE[v.state] ?? ""}`}>
                    {v.state}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">{v.detail}</div>
              </div>
            ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active sandboxes" value={String(d?.active ?? "—")} tone="success" />
        <StatCard label="Resetting now" value={String(d?.resetting ?? "—")} tone="warning" />
        <StatCard label="Expiring in 24h" value={String(d?.expiring_24h ?? "—")} tone="warning" />
        <StatCard label="Cleanups today" value={String(d?.cleanups_today ?? "—")} tone="premium" />
      </div>

      {/* -------------------------------------------------------- policy */}
      {s && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> Reset &amp; expiry policy
            </h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                Auto database reset every
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    defaultValue={s.auto_reset_hours}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v && v !== s.auto_reset_hours) settings.mutate({ auto_reset_hours: v });
                    }}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  hours
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                Sandbox expires after idle
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    defaultValue={s.expire_after_idle_hours}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v && v !== s.expire_after_idle_hours)
                        settings.mutate({ expire_after_idle_hours: v });
                    }}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  hours
                </span>
              </label>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                Cleanup window
                <span>
                  {String(s.cleanup_at).slice(0, 5)} {s.cleanup_timezone}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                Warnings before expiry
                <span>{s.warning_hours?.join(", ")} hours</span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                A heartbeat does not keep a sandbox alive — only a real request, an authenticated
                action or an interaction pushes the idle expiry out.
              </p>
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Automation</h3>
            <div className="space-y-2">
              {([
                ["auto_reset_db", "Auto reset database", caps.database_reset?.state],
                ["auto_reset_uploads", "Auto reset uploads", caps.uploads_reset?.state],
                ["rotate_credentials", "Rotate demo credentials", caps.credential_rotation?.state],
                ["keep_session_logs", "Keep session logs", "CONNECTED"],
              ] as const).map(([k, lbl, state]) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={Boolean(s[k as keyof typeof s])}
                    onChange={(e) => settings.mutate({ [k]: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{lbl}</span>
                  {state && state !== "CONNECTED" && (
                    <span className={`ml-auto text-[10px] font-semibold ${CAP_TONE[state] ?? ""}`}>
                      {state}
                    </span>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                A toggle that is on but marked BLOCKED means the policy is stored and will take
                effect the moment a runtime exists. It does not mean the operation runs today.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* --------------------------------------------- revealed credential */}
      {revealed && (
        <Card className="mt-4 border-emerald-500/40">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <KeyRound className="h-4 w-4 text-emerald-500" />
              New {label(revealed.role)} credential for {revealed.sandbox}
            </h3>
            <button
              onClick={() => setRevealed(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-muted px-2.5 py-1.5 text-xs">{revealed.username}</code>
            <code className="rounded-lg bg-muted px-2.5 py-1.5 text-xs">{revealed.password}</code>
            <button
              onClick={() =>
                navigator.clipboard?.writeText(`${revealed.username} / ${revealed.password}`)
              }
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <p className="mt-2 text-[11px] text-amber-600">
            Copy this now. Only a bcrypt hash is stored and this password is never shown again.
            The previous credential is already invalid.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------ the registry */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">Sandboxes</h3>
          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sandbox reference or product"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">All statuses</option>
            {Object.keys(d?.by_status ?? {}).map((k) => (
              <option key={k} value={k}>{label(k)}</option>
            ))}
          </select>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyHint text="No sandbox exists yet. A sandbox is created from a demo domain in the Demo Domain console, and its record and lifecycle are real even though no environment can be provisioned." />
        ) : (
          <div className="space-y-2">
            {rows.map((r: SandboxRow) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-semibold">{r.product ?? "Untitled product"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.sandbox_ref} · {r.hostname ?? "no hostname"} · {r.owner ?? "first-party"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.qualifying_hits} qualifying hit(s) · last activity {when(r.last_activity_at)}
                      {r.hours_remaining !== null && ` · expires in ${r.hours_remaining}h`}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className={`text-[11px] font-semibold ${
                      r.isolation === "none" ? "text-rose-500" : "text-emerald-500"
                    }`}>
                      {r.isolation === "none" ? "no isolation" : r.isolation}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">isolation</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold">
                      {r.baseline_captured ? "captured" : "none"}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">baseline</div>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    STATUS_TONE[r.status] ?? STATUS_TONE.provisioning
                  }`}>
                    {label(r.status)}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => reset.mutate({ id: r.id })}
                      disabled={r.locked || reset.isPending}
                      title={r.locked ? "Another operation is already running on this sandbox." : undefined}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-40"
                    >
                      {r.locked ? <Lock className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                      Reset
                    </button>
                    {(["demo_user", "demo_admin"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          if (window.confirm(
                            `Rotate the ${label(role)} credential? The current one stops working immediately and the new password is shown only once.`,
                          )) rotate.mutate({ id: r.id, role, ref: r.sandbox_ref });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        <KeyRound className="h-3 w-3" /> {role === "demo_admin" ? "Admin" : "User"}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const h = window.prompt("Extend by how many hours?", "48");
                        const n = Number(h);
                        if (Number.isInteger(n) && n > 0) extend.mutate({ id: r.id, hours: n });
                      }}
                      className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      Extend
                    </button>
                  </div>
                </div>

                {r.credentials.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {r.credentials.map((c) => (
                      <span key={c.role} className="rounded-lg bg-muted px-2 py-1 text-[11px]">
                        {label(c.role)}: <code>{c.username}</code> · v{c.version}
                        {c.expires_at ? ` · rotates ${when(c.expires_at)}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {r.failure_reason && (
                  <div className="mt-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600">
                    {r.failure_reason}
                  </div>
                )}

                {r.last_reset && (
                  <div className="mt-1.5 rounded-lg border border-border/60 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <AlertTriangle className={`h-3 w-3 ${
                        r.last_reset.outcome === "succeeded" ? "text-emerald-500" : "text-amber-600"
                      }`} />
                      <span className="font-semibold">Last reset: {r.last_reset.outcome}</span>
                      <span className="text-muted-foreground">{when(r.last_reset.at)}</span>
                    </div>
                    <div className="mt-0.5 grid gap-0.5 text-[10px] text-muted-foreground md:grid-cols-2">
                      {Object.entries(r.last_reset.stages ?? {}).map(([k, v]) => (
                        <div key={k}>
                          <span className="capitalize">{label(k)}</span>: {String(v)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {d?.infrastructure && (
        <Card className="mt-4">
          <h3 className="mb-1 text-sm font-bold">Infrastructure</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {String(d.infrastructure.note)}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Server instances" value={String(d.infrastructure.server_instances ?? 0)} />
            <StatCard
              label="Unhealthy servers"
              value={String(d.infrastructure.unhealthy_servers ?? 0)}
              tone={Number(d.infrastructure.unhealthy_servers ?? 0) > 0 ? "destructive" : "default"}
            />
            <StatCard label="Sandboxes tracked" value={String(d.total ?? 0)} />
          </div>
        </Card>
      )}
    </div>
  );
}

export default SandboxControls;
