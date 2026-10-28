import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  readScannerCount,
  readScannerProviderStatus,
  readScannerRows,
} from "@/lib/security/scanner-console.server";

/**
 * What the Upload Security Scanner console reads and writes.
 *
 * The pipeline behind it was already built - security_assets, scan jobs,
 * findings, quarantine, an append-only event log, scanner settings and
 * provider configuration, with RLS and an anon deny on every one of them - and
 * six functions that run it. What was missing was anything that read it: the
 * screen showed 1,428 scans, 14 threats blocked, 7 under review and a 99.1%
 * clean rate, none of which came from anywhere.
 *
 * Every number below is counted from the tables at the moment of the request.
 * Where there is nothing to count the answer is null, and the screen says so,
 * because a clean rate computed from no scans is not a clean rate.
 *
 * This is a server route rather than a database function for one reason: the
 * project has no path to run DDL today, so adding SQL functions is not
 * possible. It follows the same shape as /api/manager/resource - service role
 * on the server, operator required, nothing reachable from a browser.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = Record<string, unknown>;

/** The seven categories section 2 names, in the order the screen shows them. */
const CATEGORIES = [
  { key: "malware", label: "Malware" },
  { key: "dangerous_script", label: "Dangerous Scripts" },
  { key: "hidden_redirect", label: "Hidden Redirects" },
  { key: "external_tracking", label: "External Tracking" },
  { key: "fake_branding", label: "Fake Branding" },
  { key: "copyright", label: "Copyright Violations" },
  { key: "duplicate", label: "Duplicate Products" },
] as const;

export const Route = createFileRoute("/api/security/console")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const midnight = new Date();
        midnight.setUTCHours(0, 0, 0, 0);
        const since = midnight.toISOString();

        try {
          const fetchRows = (path: string) => readScannerRows(url(), admin(), path);
          const fetchCount = (path: string) => readScannerCount(url(), admin(), path);
          const [
            scansToday,
            threatsBlocked,
            quarantineOpen,
            pendingFindings,
            completed,
            clean,
            errored,
            queued,
            scanning,
            totalAssets,
            settingsRows,
            latestJobs,
            providers,
            dmcaOpen,
          ] = await Promise.all([
            fetchCount(`security_scan_jobs?select=id&created_at=gte.${since}`),
            fetchCount("security_scan_jobs?select=id&status=eq.blocked"),
            fetchCount("security_quarantine?select=id&state=in.(quarantined,under_review)"),
            fetchCount("security_findings?select=id&result=eq.pending"),
            fetchCount("security_scan_jobs?select=id&status=in.(completed,flagged,blocked)"),
            fetchCount("security_scan_jobs?select=id&status=eq.completed"),
            fetchCount("security_scan_jobs?select=id&status=eq.error"),
            fetchCount("security_scan_jobs?select=id&status=eq.queued"),
            fetchCount("security_scan_jobs?select=id&status=eq.scanning"),
            fetchCount("security_assets?select=id"),
            fetchRows("security_scanner_settings?select=*&limit=1"),
            fetchRows("security_scan_jobs?select=*&order=created_at.desc&limit=1"),
            readScannerProviderStatus(url(), admin()),
            fetchCount("security_dmca_queue?select=id&status=neq.closed"),
          ]);

          // The latest scan, with the asset it was for and every finding on it.
          const job = latestJobs[0] ?? null;
          let asset: Row | null = null;
          let findings: Row[] = [];
          let product: Row | null = null;
          if (job) {
            const [assets, found] = await Promise.all([
              fetchRows(
                `security_assets?select=*&id=eq.${encodeURIComponent(String(job.asset_id))}&limit=1`,
              ),
              fetchRows(
                `security_findings?select=*&job_id=eq.${encodeURIComponent(String(job.id))}&order=created_at.asc`,
              ),
            ]);
            asset = assets[0] ?? null;
            findings = found;
            if (asset?.product_id) {
              const products = await fetchRows(
                `marketplace_products?select=id,name,slug&id=eq.${encodeURIComponent(String(asset.product_id))}&limit=1`,
              );
              product = products[0] ?? null;
            }
          }

          // A category with no finding on this job is not "0 detected" - it is
          // pending, because nothing has reported on it.
          const byCategory = CATEGORIES.map((c) => {
            const hits = findings.filter((f) => f.category === c.key);
            if (hits.length === 0) {
              return {
                key: c.key,
                label: c.label,
                result: "PENDING",
                count: 0,
                detail: "Not reported on this scan.",
              };
            }
            const worst =
              hits.find((h) => h.result === "blocked") ??
              hits.find((h) => h.result === "error") ??
              hits.find((h) => h.result === "flagged") ??
              hits.find((h) => h.result === "pending") ??
              hits[0];
            return {
              key: c.key,
              label: c.label,
              result: String(worst.result ?? "pending").toUpperCase(),
              count: hits.length,
              detail: String(worst.title ?? ""),
              severity: String(worst.severity ?? "low"),
              source: String(worst.source ?? "static"),
              evidence: worst.evidence ?? [],
            };
          });

          return Response.json({
            ok: true,
            metrics: {
              scans_today: scansToday,
              threats_blocked: threatsBlocked,
              under_review: quarantineOpen + pendingFindings,
              // Null, not 100%, when nothing has been scanned. A rate computed
              // from no scans is not a rate.
              clean_rate: completed > 0 ? Math.round((clean / completed) * 1000) / 10 : null,
              completed,
              errored,
              queued,
              scanning,
              total_assets: totalAssets,
              dmca_open: dmcaOpen,
            },
            provider: providers,
            settings: settingsRows[0] ?? null,
            latest: job
              ? {
                  job,
                  asset,
                  product,
                  categories: byCategory,
                  findings,
                }
              : null,
          });
        } catch (error) {
          console.error("[security] scanner console read failed", error);
          return Response.json({ error: "Could not read the scanner data." }, { status: 502 });
        }
      },
    },
  },
});
