import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon, Info, Lock, RefreshCw, ShieldAlert, ShieldCheck, Wand2,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  decideBrandException, enforceBranding, escalateBrandCase, expireBrandExceptions,
  getBrandProtection, setBrandPolicy, verifyBrandAsset,
  type BrandAsset, type BrandCase, type BrandRule, type BrandView,
} from "@/lib/marketplace-manager/brand.functions";

/**
 * Favicon & Branding Protection — the screen that already existed, connected.
 *
 * It showed "12,842 protected assets", "316 replaced today" and "24 violations
 * blocked", and listed replacement rules pointing at svala-favicon.ico and
 * svala-apple-touch.png. None of those numbers came from anywhere and neither
 * of those files exists.
 *
 * What is true: Software Vala has exactly one canonical brand asset on disk,
 * public/favicon.png — 64x64, 6,052 bytes, with its SHA-256 recorded — and not
 * one of the 5,533 products currently sets a favicon or logo of its own. So the
 * honest reading of this screen today is one protected asset, no violations,
 * and five rules of which only the ones with a real canonical file can enforce.
 * The registry says which, rather than hiding it.
 *
 * Two behaviours are worth knowing while using it. Under MONITOR nothing is
 * changed — violations are recorded and left alone. And enforcement governs
 * marketplace surfaces only: the contents of a downloadable software package
 * are never read or rewritten, so a customer's software keeps its own branding.
 */

const POLICY_TONE: Record<string, string> = {
  enforce: "bg-emerald-500/10 text-emerald-500",
  monitor: "bg-amber-500/10 text-amber-500",
  disabled: "bg-rose-500/10 text-rose-500",
};

const CLASS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-500",
  whitelisted: "bg-sky-500/10 text-sky-500",
  unknown: "bg-amber-500/10 text-amber-500",
  blocked: "bg-rose-500/10 text-rose-500",
};

const label = (s: string) => s.replace(/_/g, " ");
const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function BrandProtection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"cases" | "whitelist" | "history">("cases");
  const [note, setNote] = useState<string | null>(null);
  const [run, setRun] = useState<Awaited<ReturnType<typeof enforceBranding>> | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "brand", tab],
    queryFn: () => getBrandProtection({ data: { tab } }),
    staleTime: 10_000,
  });
  const d = q.data as BrandView | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "brand"] });
  };

  const enforce = useMutation({
    mutationFn: () => enforceBranding({ data: {} }),
    onSuccess: (res) => {
      if (res.ok) {
        setRun(res);
        setNote(res.note ?? null);
      } else setNote(res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "brand"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const policy = useMutation({
    mutationFn: (v: Parameters<typeof setBrandPolicy>[0]["data"]) => setBrandPolicy({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const verify = useMutation({
    mutationFn: (v: { key: string }) => verifyBrandAsset({ data: v }),
    onSuccess: (res) => {
      setNote(
        res.state === "intact"
          ? "The canonical asset matches its recorded hash."
          : res.message ?? `Integrity check: ${res.state}`,
      );
      void qc.invalidateQueries({ queryKey: ["marketplace", "brand"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const exception = useMutation({
    mutationFn: (v: { id: string; status: "active" | "revoked"; reason?: string }) =>
      decideBrandException({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const expire = useMutation({
    mutationFn: () => expireBrandExceptions(),
    onSuccess: (res) => {
      setNote(res.ok ? `${res.expired ?? 0} exception(s) expired; protection resumed on those.` : null);
      void qc.invalidateQueries({ queryKey: ["marketplace", "brand"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const escalate = useMutation({
    mutationFn: (v: { id: string; reason: string }) => escalateBrandCase({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok ? `Raised with Legal as ${res.legal_reference}. ${res.note ?? ""}` : res.message ?? null);
      void qc.invalidateQueries({ queryKey: ["marketplace", "brand"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · Brand Protection" title="Favicon &amp; Branding Protection" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const s = d?.settings;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Brand Protection"
        title="Favicon & Branding Protection"
        description="Author-supplied branding on marketplace surfaces is detected and replaced with the canonical Software Vala identity. Downloadable package contents are never touched."
        actions={
          <>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Vala AI
          </button>
          <button
            onClick={() => enforce.mutate()}
            disabled={enforce.isPending || s?.policy_state === "disabled"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {enforce.isPending ? "Running…" : "Enforce now"}
          </button>
          </>
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Protected assets" value={String(d?.protected_assets ?? "—")} tone="success" />
        <StatCard label="Replaced today" value={String(d?.replaced_today ?? "—")} tone="premium" />
        <StatCard label="Violations open" value={String(d?.violations_open ?? "—")} tone="warning" />
        <StatCard label="Whitelist exceptions" value={String(d?.whitelist_active ?? "—")} />
      </div>

      {/* ------------------------------------------------------ the policy */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold">Global policy</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            POLICY_TONE[s?.policy_state ?? "monitor"]
          }`}>
            {s?.policy_state ?? "—"}
          </span>
          <div className="flex items-center gap-1">
            {(["monitor", "enforce"] as const).map((p) => (
              <button
                key={p}
                onClick={() => policy.mutate({ policy_state: p })}
                disabled={s?.policy_state === p}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-40"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => {
                const reason = window.prompt(
                  "Disabling brand protection stops all detection and replacement. Why? This is recorded permanently and needs an admin.",
                );
                if (reason && reason.trim())
                  policy.mutate({ policy_state: "disabled", reason });
              }}
              className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
            >
              disable
            </button>
          </div>
        </div>

        <p className="mb-3 text-[11px] text-muted-foreground">
          Under <strong>monitor</strong> nothing is changed — every non-compliant asset is recorded
          as a case and left alone. Under <strong>enforce</strong> a replacement is applied only
          where an approved canonical asset exists, and is read back afterwards; one that does not
          verify is recorded as failed, never as success. Disabling needs an admin and a reason.
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          {([
            ["block_third_party_favicons", "Block third-party favicons"],
            ["block_third_party_manifest", "Block third-party manifest and PWA branding"],
            ["block_external_logo_overrides", "Block external logo overrides"],
            ["replace_on_upload", "Replace on upload"],
            ["allow_whitelist_exceptions", "Allow whitelist exceptions"],
          ] as const).map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={Boolean(s?.[k])}
                onChange={(e) => policy.mutate({ [k]: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              {lbl}
            </label>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Package contents are never modified — not a setting
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------- the enforcement run */}
      {run && (
        <Card className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Wand2 className="h-4 w-4 text-muted-foreground" /> Enforcement run — policy {run.policy}
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {([
              ["Scanned", run.scanned], ["Compliant", run.compliant],
              ["Replaced", run.replaced], ["Blocked", run.blocked],
              ["Flagged", run.flagged], ["Whitelisted", run.whitelisted],
              ["Failed", run.failed],
            ] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border/60 px-3 py-2">
                <div className="text-sm font-semibold">{v ?? 0}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          {run.note && <p className="mt-2 text-[11px] text-muted-foreground">{run.note}</p>}
        </Card>
      )}

      {/* ------------------------------------------------------- the registry */}
      <Card className="mt-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <ImageIcon className="h-4 w-4 text-muted-foreground" /> Canonical asset registry
        </h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Only an approved asset with a real file behind it can be used to replace anything. The
          rest are registered and marked unusable rather than given an invented path.
        </p>
        <div className="space-y-1">
          {d?.assets?.map((a: BrandAsset) => (
            <div key={a.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
              <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                a.usable ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
              }`}>
                {a.usable ? "✓" : "—"}
              </span>
              <span className="text-xs font-semibold">{a.name}</span>
              <span className="text-[11px] text-muted-foreground">{label(a.type)}</span>
              {a.path && <code className="text-[11px]">{a.path}</code>}
              {a.width && (
                <span className="text-[11px] text-muted-foreground">
                  {a.width}×{a.height} · {a.bytes?.toLocaleString()} bytes
                </span>
              )}
              {a.sha256 && (
                <code className="text-[10px] text-muted-foreground">{a.sha256.slice(0, 16)}…</code>
              )}
              <span className="flex-1" />
              {a.usable ? (
                <button
                  onClick={() => verify.mutate({ key: a.key })}
                  disabled={verify.isPending}
                  className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Verify integrity
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">{a.note}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------------------- the rules */}
      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-bold">Enforcement rules</h3>
        <div className="space-y-1">
          {d?.rules?.map((r: BrandRule) => (
            <div key={r.key} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">{r.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {r.action}
                </span>
                <span className="text-[11px] text-muted-foreground">{r.severity}</span>
                <span className="flex-1" />
                <span className={`text-[11px] font-semibold ${
                  r.enforceable ? "text-emerald-500" : "text-amber-600"
                }`}>
                  {r.enforceable ? "enforceable" : "no canonical asset"}
                </span>
              </div>
              {r.notes && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.notes}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------ vision status */}
      {d?.vision_note && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-muted-foreground" /> {d.vision_analysis}
          </h3>
          <p className="text-[11px] text-muted-foreground">{d.vision_note}</p>
        </Card>
      )}

      {/* -------------------------------------------------------- the cases */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["cases", "whitelist", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize ${
                tab === t ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t === "history" ? "Replacement history" : t}
            </button>
          ))}
          <button
            onClick={() => void q.refetch()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          {tab === "whitelist" && (
            <button
              onClick={() => expire.mutate()}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Expire what has run out
            </button>
          )}
        </div>

        {tab === "cases" ? (
          (d?.cases?.length ?? 0) === 0 ? (
            <EmptyHint text="No branding violation has been recorded. Not one product in the catalogue sets a favicon or logo of its own." />
          ) : (
            <div className="space-y-2">
              {d?.cases?.map((c: BrandCase) => (
                <div key={c.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">{c.case_no}</span>
                    <span className="text-xs">{c.product}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.owner ?? "first-party"} · {label(c.surface)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      CLASS_TONE[c.classification] ?? CLASS_TONE.unknown
                    }`}>
                      {c.classification}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{c.severity}</span>
                    <span className="flex-1" />
                    <span className="text-[11px] font-semibold">{label(c.status)}</span>
                    {c.legal_reference ? (
                      <span className="text-[11px] text-muted-foreground">{c.legal_reference}</span>
                    ) : (
                      <button
                        onClick={() => {
                          const reason = window.prompt(
                            "Raise this with Legal Manager. Why? The legal record itself must be created there.",
                          );
                          if (reason && reason.trim()) escalate.mutate({ id: c.id, reason });
                        }}
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Escalate to Legal
                      </button>
                    )}
                  </div>
                  {c.reference && (
                    <code className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {c.reference}
                    </code>
                  )}
                  {c.evidence?.[0]?.why && (
                    <div className="text-[11px] text-muted-foreground">{c.evidence[0].why}</div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : tab === "whitelist" ? (
          (d?.whitelist?.length ?? 0) === 0 ? (
            <EmptyHint text="No exception has been requested." />
          ) : (
            <div className="space-y-1">
              {d?.whitelist?.map((w) => (
                <div key={String(w.id)} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <span className="text-xs font-semibold">{String(w.product)}</span>
                  <span className="text-[11px] text-muted-foreground">{label(String(w.rule))}</span>
                  <span className="flex-1 text-[11px] text-muted-foreground">{String(w.reason)}</span>
                  {w.expires_at && (
                    <span className="text-[11px] text-muted-foreground">
                      until {when(String(w.expires_at))}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold">{String(w.status)}</span>
                  {w.status === "pending" && (
                    <button
                      onClick={() => exception.mutate({ id: String(w.id), status: "active" })}
                      className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted"
                    >
                      Approve
                    </button>
                  )}
                  {w.status === "active" && (
                    <button
                      onClick={() => {
                        const r = window.prompt("Why is this exception being revoked?");
                        if (r && r.trim())
                          exception.mutate({ id: String(w.id), status: "revoked", reason: r });
                      }}
                      className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-rose-500 hover:bg-muted"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (d?.history?.length ?? 0) === 0 ? (
          <EmptyHint text="Nothing has been replaced yet." />
        ) : (
          <div className="space-y-1">
            {d?.history?.map((h) => (
              <div key={String(h.id)} className="rounded-lg border border-border/60 px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">{String(h.product)}</span>
                  <span className="text-[11px] text-muted-foreground">{label(String(h.surface))}</span>
                  <span className="flex-1" />
                  <span className={`text-[11px] font-semibold ${
                    h.verified ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {h.verified ? "verified" : "ENFORCEMENT_FAILED"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{when(String(h.at))}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <code>{String(h.from ?? "—")}</code> → <code>{String(h.to)}</code>
                </div>
                {h.detail && (
                  <div className="text-[10px] text-muted-foreground">{String(h.detail)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- the scope */}
      <Card className="mt-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" /> What this governs
        </h3>
        <p className="text-[11px] text-muted-foreground">{d?.scope_note}</p>
        {d?.surfaces && (
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Products in scope" value={(d.surfaces.products ?? 0).toLocaleString()} />
            <StatCard label="Set their own favicon" value={String(d.surfaces.products_with_own_favicon ?? 0)} />
            <StatCard label="Set their own logo" value={String(d.surfaces.products_with_own_logo ?? 0)} />
            <StatCard label="Have a demo" value={String(d.surfaces.demos ?? 0)} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default BrandProtection;
