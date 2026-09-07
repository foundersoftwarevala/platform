import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Copy, ExternalLink, Globe2, Info, KeyRound, QrCode,
  RefreshCw, Search, ShieldCheck, Timer,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  demoOperation, getDemoDomains, provisionDemo, runDemoExpiry, setDemoPassword,
  setDemoSettings, type DemoRow, type DemoStatus, type DemoView,
} from "@/lib/marketplace-manager/demodomain.functions";

/**
 * Demo Domain Manager — the screen that already existed, now connected.
 *
 * The honest position, established by calling the APIs rather than reading
 * configuration files:
 *
 *   DNS         Cloudflare does not authenticate. The zone and account IDs are
 *               the right shape, but CLOUDFLARE_API_TOKEN holds a 32-character
 *               hex value — that is the shape of an ID, not a token — and both
 *               auth forms return "Invalid request headers".
 *   SSL         depends on the same credential.
 *   Deployment  no provider exists at all.
 *
 * So no demo can be provisioned, and this screen says so instead of showing
 * domains that were never created. What it does do is real: it generates a
 * unique hostname, reserves it so no other product can take it, runs the
 * eligibility gates owned by Moderation, Upload Security, Brand Protection and
 * Legal, tracks expiry from actual timestamps and reads health from the monitor
 * that already runs every fifteen minutes.
 *
 * The thirteen demos this marketplace actually links to today are hosted
 * elsewhere — mostly lovable.app — and are shown as external rather than
 * presented as provisioned Software Vala demos, which they are not.
 */

const TABS = ["all", "live", "resetting", "disabled", "expired"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, string> = {
  live: "bg-emerald-500/10 text-emerald-500",
  provisioning: "bg-sky-500/10 text-sky-500",
  dns_pending: "bg-amber-500/10 text-amber-500",
  ssl_pending: "bg-amber-500/10 text-amber-500",
  deploying: "bg-sky-500/10 text-sky-500",
  health_check: "bg-sky-500/10 text-sky-500",
  resetting: "bg-amber-500/10 text-amber-500",
  draft: "bg-muted text-muted-foreground",
  disabled: "bg-muted text-muted-foreground",
  expired: "bg-rose-500/10 text-rose-500",
  failed: "bg-rose-500/10 text-rose-500",
};

const PROVIDER_TONE: Record<string, string> = {
  CONNECTED: "text-emerald-500",
  REQUIRES_CONFIGURATION: "text-amber-600",
  DEPLOYMENT_PROVIDER_NOT_CONFIGURED: "text-rose-500",
  NOT_CONFIGURED: "text-muted-foreground",
};

const label = (s: string) => s.replace(/_/g, " ");
const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

export function DemoDomainManager() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<{ url: string; product: string } | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "demo-domains", tab, search],
    queryFn: () => getDemoDomains({ data: { tab, search: search || undefined } }),
    staleTime: 10_000,
  });
  const d = q.data as DemoView | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string; note?: string | null }) => {
    setNote(res.ok ? res.note ?? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "demo-domains"] });
  };

  const op = useMutation({
    mutationFn: (v: { id: string; op: "enable" | "disable" | "reset" | "regenerate" | "renew"; reason?: string }) =>
      demoOperation({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const password = useMutation({
    mutationFn: (v: { id: string; password: string | null }) => setDemoPassword({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok ? res.note ?? "Saved." : res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "demo-domains"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const expiry = useMutation({
    mutationFn: () => runDemoExpiry(),
    onSuccess: (res) => {
      setNote(res.ok
        ? `${res.reminded ?? 0} reminder(s) sent, ${res.entered_grace ?? 0} in grace, ${res.expired ?? 0} expired. ${res.note ?? ""}`
        : `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "demo-domains"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const settings = useMutation({
    mutationFn: (v: Parameters<typeof setDemoSettings>[0]["data"]) => setDemoSettings({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const copy = (url: string) => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => { setCopied(url); setTimeout(() => setCopied(null), 2000); })
      .catch(() => setNote("The clipboard is not available in this browser."));
  };

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · Demo Domains" title="Demo Domain Manager" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const p = d?.providers;
  const s = d?.settings;
  const rows = d?.demos ?? [];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Demo Domains"
        title="Demo Domain Manager"
        description="Isolated demo subdomains on Software Vala infrastructure — generation, DNS, SSL, deployment, health, expiry and branding."
        actions={
          <button
            onClick={() => expiry.mutate()}
            disabled={expiry.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Timer className="h-3.5 w-3.5" />
            {expiry.isPending ? "Running…" : "Run expiry sweep"}
          </button>
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      {/* --------------------------------------------- provider reality */}
      {p && !p.can_provision && (
        <Card className="mb-4 border-amber-500/40">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> No demo can be provisioned yet
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">{p.note}</p>
          <div className="space-y-1">
            {p.providers.map((pr) => (
              <div key={pr.slug} className="rounded-lg border border-border/60 px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">{pr.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {pr.kind}
                  </span>
                  {pr.credential_env && (
                    <code className="text-[10px] text-muted-foreground">{pr.credential_env}</code>
                  )}
                  <span className={`ml-auto text-[11px] font-semibold ${PROVIDER_TONE[pr.state] ?? ""}`}>
                    {pr.state}
                  </span>
                </div>
                {pr.last_error && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{pr.last_error}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Demo records" value={String(d?.counts?.total ?? "—")} />
        <StatCard label="Live" value={String(d?.counts?.live ?? "—")} tone="success" />
        <StatCard label="Disabled" value={String(d?.counts?.disabled ?? "—")} />
        <StatCard label="Expired" value={String(d?.counts?.expired ?? "—")} tone="warning" />
      </div>

      {/* ---------------------------------------------- external demos */}
      {d?.external_demos && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Globe2 className="h-4 w-4 text-muted-foreground" />
            The {d.external_demos.count} demos the marketplace links to today
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">{d.external_demos.note}</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(d.external_demos.hosts ?? {}).map(([host, n]) => (
              <span key={host} className="rounded-lg border border-border/60 px-2 py-1 text-[11px]">
                {host} <span className="text-muted-foreground">×{n}</span>
              </span>
            ))}
          </div>
          {d.health && (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Working" value={String(d.health.working ?? 0)} tone="success" />
              <StatCard label="Slow" value={String(d.health.slow ?? 0)} tone="warning" />
              <StatCard label="Offline" value={String(d.health.offline ?? 0)} tone="destructive" />
              <StatCard label="Health checks recorded" value={String(d.health.checks_recorded ?? 0)} />
            </div>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------ settings */}
      {s && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-bold">Demo policy</h3>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[11px] text-muted-foreground">
              base domain <code className="text-foreground">{s.base_domain}</code>
            </span>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              lifetime
              <input
                type="number"
                min={1}
                defaultValue={s.default_ttl_days}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== s.default_ttl_days) settings.mutate({ default_ttl_days: v });
                }}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              />
              days
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              grace
              <input
                type="number"
                min={0}
                defaultValue={s.grace_days}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== s.grace_days) settings.mutate({ grace_days: v });
                }}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              />
              days
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={s.password_protect_by_default}
                onChange={(e) => settings.mutate({ password_protect_by_default: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              password protect by default
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={s.block_search_indexing}
                onChange={(e) => settings.mutate({ block_search_indexing: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              block search indexing
            </label>
            <span className="text-[11px] text-muted-foreground">
              reminders at {s.reminder_days?.join(", ")} days
            </span>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------- the demo table */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize ${
                tab === t ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t === "all" ? "All demos" : t}
            </button>
          ))}
          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hostname, slug or demo reference"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
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
          <EmptyHint text="No demo has been prepared here yet. A demo can be prepared and its hostname reserved even without a provider — it simply cannot go live until DNS, SSL and a deployment runtime authenticate." />
        ) : (
          <div className="space-y-2">
            {rows.map((r: DemoRow) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-semibold">{r.product ?? "Untitled product"}</div>
                    <code className="text-[11px] text-muted-foreground">{r.url}</code>
                    <div className="text-[11px] text-muted-foreground">
                      {r.demo_ref} · {r.owner ?? "first-party"}
                      {r.days_remaining !== null && (
                        <> · {r.days_remaining === 0 ? "expired" : `expires in ${r.days_remaining} day(s)`}</>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[11px] font-semibold">{label(r.dns_status)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">dns</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold">{label(r.ssl_status)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">ssl</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold">{r.health}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">health</div>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    STATUS_TONE[r.status] ?? STATUS_TONE.draft
                  }`}>
                    {label(r.status)}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => copy(r.url)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" /> {copied === r.url ? "Copied" : "Copy"}
                    </button>
                    {/* Open is only offered when the demo could actually answer. */}
                    {r.status === "live" ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    ) : (
                      <span
                        title={`This demo is ${label(r.status)}. The address is reserved but nothing answers on it.`}
                        className="rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground"
                      >
                        not live
                      </span>
                    )}
                    <button
                      onClick={() => setQr({ url: r.url, product: r.product ?? r.hostname })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      <QrCode className="h-3 w-3" /> QR
                    </button>
                    <button
                      onClick={() => {
                        const pw = window.prompt(
                          "Set a demo password (at least eight characters). Leave empty to remove protection.",
                        );
                        if (pw !== null) password.mutate({ id: r.id, password: pw || null });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      <KeyRound className="h-3 w-3" /> {r.password_protected ? "Password" : "Open access"}
                    </button>
                    {r.status === "disabled" || r.status === "expired" ? (
                      <button
                        onClick={() => op.mutate({ id: r.id, op: "enable" })}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const why = window.prompt("Why is this demo being disabled?");
                          if (why && why.trim()) op.mutate({ id: r.id, op: "disable", reason: why });
                        }}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const why = window.prompt("Why is this demo being regenerated?");
                        if (why && why.trim()) op.mutate({ id: r.id, op: "regenerate", reason: why });
                      }}
                      className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => op.mutate({ id: r.id, op: "renew" })}
                      className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      Renew
                    </button>
                  </div>
                </div>

                {r.failure_reason && (
                  <div className="mt-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600">
                    {r.failure_reason}
                  </div>
                )}
                {r.last_job && r.last_job.status !== "succeeded" && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Last job: {label(r.last_job.operation)} — {r.last_job.status}
                    {r.last_job.error ? ` · ${r.last_job.error}` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------- the QR */}
      {qr && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">QR for {qr.product}</h3>
            <button
              onClick={() => setQr(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Rendered from the real demo URL by a public QR service. Nothing
                is stored, and the target is the address in the table above. */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qr.url)}`}
              alt={`QR code for ${qr.url}`}
              width={180}
              height={180}
              className="rounded-lg border border-border bg-white p-2"
            />
            <div className="text-[11px] text-muted-foreground">
              <div>Target: <code className="text-foreground">{qr.url}</code></div>
              <p className="mt-1 max-w-md">
                Scan counts are not tracked, so none are shown. Claiming an analytics figure
                nothing measures would be worse than showing nothing.
              </p>
              <button
                onClick={() => copy(qr.url)}
                className="mt-2 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
              >
                Copy target
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------- infrastructure */}
      {d?.infrastructure && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Infrastructure
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {String(d.infrastructure.note)}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Server instances" value={String(d.infrastructure.server_instances ?? 0)} />
            <StatCard label="Regions" value={String(d.infrastructure.regions ?? 0)} />
            <StatCard label="Deployments" value={String(d.infrastructure.deployments ?? 0)} />
          </div>
        </Card>
      )}

      {(d?.events?.length ?? 0) > 0 && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-muted-foreground" /> Recent activity
          </h3>
          <div className="space-y-1">
            {d?.events?.slice(0, 20).map((e, i) => (
              <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                <span className="font-semibold">{label(e.event)}</span>
                <span className="text-muted-foreground">
                  {e.from ? ` · ${label(e.from)} → ${label(e.to ?? "")}` : ""}
                  {" · "}{when(e.at)}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default DemoDomainManager;
