import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bug, Loader2, Radar, ScanLine, ShieldCheck } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * Upload Security Scanner — the screen that already existed, now connected.
 *
 * It showed 1,428 scans today, 14 threats blocked, 7 under review and a 99.1%
 * clean rate. None of those came from anywhere. Under them sat seven detection
 * categories with written-in verdicts — "Malware: 0 detected" on a platform
 * where no file had ever been scanned for malware — and five configuration
 * toggles that were React state and forgot themselves on every navigation.
 *
 * Everything here is counted from security_scan_jobs, security_findings,
 * security_quarantine and security_assets at the moment of the request, and
 * the toggles are written to security_scanner_settings with an immutable row
 * in security_events for each change.
 *
 * Two deliberate refusals:
 *
 *   A clean rate over no completed scans is null, not 100%.
 *   A category nothing has reported on is PENDING, not "0 detected" — because
 *   with no malware engine configured, nothing has looked.
 *
 * The design is the one that was there: same title, same subtitle, same four
 * metric cards, same seven categories, same configuration panel.
 */

type Category = {
  key: string;
  label: string;
  result: string;
  count: number;
  detail: string;
  severity?: string;
  source?: string;
};

type Console = {
  ok: boolean;
  metrics: {
    scans_today: number;
    threats_blocked: number;
    under_review: number;
    clean_rate: number | null;
    completed: number;
    errored: number;
    queued: number;
    scanning: number;
    total_assets: number;
    dmca_open: number;
  };
  provider: {
    malware_scanning?: string;
    static_analysis?: string;
    ready_providers?: number;
    note?: string | null;
    providers?: { slug: string; label: string; kind: string; state: string; credential_env: string | null }[];
  } | null;
  settings: Record<string, unknown> | null;
  latest: {
    job: Record<string, unknown>;
    asset: Record<string, unknown> | null;
    product: { id: string; name: string; slug: string } | null;
    categories: Category[];
  } | null;
};

const TONE: Record<string, string> = {
  PASS: "bg-emerald-500/10 text-emerald-500",
  FLAGGED: "bg-amber-500/10 text-amber-500",
  BLOCKED: "bg-rose-500/10 text-rose-500",
  PENDING: "bg-muted text-muted-foreground",
  ERROR: "bg-rose-500/10 text-rose-500",
};

const bytes = (value: unknown) => {
  const n = Number(value ?? 0);
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const when = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const TOGGLES: { key: string; label: string }[] = [
  { key: "block_on_malware", label: "Block upload on malware detection" },
  { key: "auto_quarantine_flagged", label: "Auto-quarantine flagged files" },
  { key: "notify_author_on_rejection", label: "Notify author on rejection" },
  { key: "attach_hash_to_assets", label: "Attach SHA-256 to every asset" },
  { key: "send_copyright_to_dmca", label: "Send report to DMCA queue" },
];

export function SecurityScanner() {
  const [data, setData] = useState<Console | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/security/console", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to open the scanner."
          : "Could not read the scanner.")));
        return;
      }
      setData(payload as Console);
    } catch {
      setError(new Error("Could not reach the server."));
    }
  }, []);

  useEffect(() => {
    void load();
    // Section 34 asks for the queue to move on its own. Polling the console is
    // what this build has; a scan that finishes is visible within the interval
    // rather than only on a manual refresh.
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const setToggle = async (key: string, value: boolean) => {
    setBusy(key);
    setNote(null);
    try {
      const response = await fetch("/api/security/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ [key]: value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote(payload?.error ?? "That setting was not saved.");
        return;
      }
      setData((current) => (current ? { ...current, settings: payload.settings } : current));
    } catch {
      setNote("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  const runFullScan = async () => {
    setBusy("full");
    setNote(null);
    try {
      const response = await fetch("/api/security/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ full: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote(payload?.error ?? "The full scan was not started.");
        return;
      }
      const r = payload.report ?? {};
      setNote(
        r.total === 0
          ? "There are no uploaded assets to scan yet."
          : `${r.total} eligible · ${r.started} queued · ${r.reused} reused from an identical file · ${r.failed} failed.`,
      );
      await load();
    } catch {
      setNote("Could not reach the server. No scan was started.");
    } finally {
      setBusy(null);
    }
  };

  const m = data?.metrics;
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const malware = data?.provider?.malware_scanning ?? "SCANNER_NOT_CONFIGURED";

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Upload Security"
        title="Upload Security Scanner"
        description="Every uploaded asset is scanned for malware, malicious scripts, hidden redirects, tracking, fake branding, copyright and duplicates."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
              Vala AI
            </PillButton>
            <PillButton variant="primary" onClick={() => void runFullScan()}>
              <span className="inline-flex items-center gap-1.5">
                {busy === "full" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                Run Full Scan
              </span>
            </PillButton>
          </>
        }
      />

      {error ? <LoadFailure error={error} what="the security scanner" onRetry={() => void load()} /> : null}

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      {malware !== "CONNECTED" && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600">
          <div className="font-semibold">Malware scanning: {malware}</div>
          <p className="mt-1 text-amber-600/80">
            {data?.provider?.note ??
              "No malware engine is configured, so no file has been scanned for malware. A malware verdict is reported as pending rather than clean."}
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Scans Today" value={m ? String(m.scans_today) : "—"} tone="premium" icon={<Radar className="h-3.5 w-3.5" />} />
        <StatCard label="Threats Blocked" value={m ? String(m.threats_blocked) : "—"} tone="destructive" icon={<Bug className="h-3.5 w-3.5" />} />
        <StatCard label="Under Review" value={m ? String(m.under_review) : "—"} tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <StatCard
          label="Clean Rate"
          // Null means no completed scan to compute it from. Saying 100% there
          // would be the most misleading number on the page.
          value={m ? (m.clean_rate === null ? "no scans yet" : `${m.clean_rate}%`) : "—"}
          tone="success"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-bold">
            {data?.latest
              ? `Latest Scan — ${data.latest.product?.name ?? data.latest.asset?.file_name ?? "Unnamed asset"}`
              : "Latest Scan"}
          </div>

          {!data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the scanner…
            </div>
          ) : !data.latest ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
              Nothing has been uploaded and scanned yet. {m?.total_assets ?? 0} asset(s) are registered.
            </div>
          ) : (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]">
                <dt className="text-muted-foreground">File</dt>
                <dd className="truncate font-medium">{String(data.latest.asset?.file_name ?? "—")}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd>{bytes(data.latest.asset?.size_bytes)}</dd>
                <dt className="text-muted-foreground">Declared MIME</dt>
                <dd className="truncate">{String(data.latest.asset?.declared_mime ?? "—")}</dd>
                <dt className="text-muted-foreground">Detected MIME</dt>
                <dd className="truncate">{String(data.latest.asset?.detected_mime ?? "not detected")}</dd>
                <dt className="text-muted-foreground">SHA-256</dt>
                <dd className="truncate font-mono text-[10px]">{String(data.latest.asset?.sha256 ?? "—")}</dd>
                <dt className="text-muted-foreground">Started</dt>
                <dd>{when(data.latest.job.started_at)}</dd>
                <dt className="text-muted-foreground">Completed</dt>
                <dd>{when(data.latest.job.completed_at)}</dd>
                <dt className="text-muted-foreground">Scanner</dt>
                <dd className="truncate">{String(data.latest.job.scanner_version ?? "—")}</dd>
                <dt className="text-muted-foreground">Result</dt>
                <dd className="font-semibold uppercase">{String(data.latest.job.status ?? "—")}</dd>
                <dt className="text-muted-foreground">Risk</dt>
                <dd>
                  {data.latest.job.risk_score === null || data.latest.job.risk_score === undefined
                    ? "not scored"
                    : `${String(data.latest.job.risk_score)} · ${String(data.latest.job.risk_level ?? "")}`}
                </dd>
              </dl>

              <div className="space-y-1.5">
                {data.latest.categories.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold">{c.label}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{c.detail}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[c.result] ?? TONE.PENDING}`}>
                      {c.result}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="mb-3 text-sm font-bold">Scanner Configuration</div>
          {!data?.settings ? (
            <div className="text-[12px] text-muted-foreground">
              {data ? "The scanner has no settings row yet." : "Reading…"}
            </div>
          ) : (
            <div className="space-y-2">
              {TOGGLES.map((t) => {
                const on = Boolean(settings[t.key]);
                return (
                  <button
                    key={t.key}
                    disabled={busy === t.key}
                    onClick={() => void setToggle(t.key, !on)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-left hover:bg-white/[0.03] disabled:opacity-50"
                  >
                    <span className="text-[12px] font-semibold">{t.label}</span>
                    <span
                      role="switch"
                      aria-checked={on}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? "left-[18px]" : "left-0.5"}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-muted-foreground">Queued / scanning</div>
              <div className="font-semibold">{m ? `${m.queued} / ${m.scanning}` : "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-muted-foreground">Scan errors</div>
              <div className="font-semibold">{m ? String(m.errored) : "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-muted-foreground">Registered assets</div>
              <div className="font-semibold">{m ? String(m.total_assets) : "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="text-muted-foreground">Open DMCA cases</div>
              <div className="font-semibold">{m ? String(m.dmca_open) : "—"}</div>
            </div>
          </div>

          {(data?.provider?.providers?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Providers</div>
              {data!.provider!.providers!.map((p) => (
                <div key={p.slug} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-muted-foreground">{p.kind}</span>
                  <span className={p.state === "CONNECTED" ? "text-emerald-500" : "text-amber-500"}>{p.state}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
            Malicious uploads are never stored — they are hashed, logged and discarded. Every setting change
            above is written to the security event log, which no signed-in role can edit or delete.
          </div>
        </Card>
      </div>
    </div>
  );
}
