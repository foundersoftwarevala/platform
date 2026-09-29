import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Loader2, Play, RefreshCcw, Upload, XCircle } from "lucide-react";

import { OpsSection } from "./OpsPrimitives";

/**
 * Taking addresses in, a few hundred at a time.
 *
 * The twelve thousand do not arrive as a file of twelve thousand; they arrive as
 * batches of two to five hundred, and each one is a separate piece of work an
 * operator can start, look at, commit and leave. So this screen is built around
 * one batch at a time: read the file, see what would happen, commit it, watch it
 * be investigated, come back to it tomorrow.
 *
 * Nothing here publishes anything. A committed batch has produced rows in the
 * review queue; putting a demo on the storefront is still the separate,
 * deliberate act it was, with its own product and category checks.
 */

type PreviewResult = {
  detected: string[];
  counts: Record<string, number>;
  invalid: { line: number; reason: string; sample: string }[];
  sample: { url: string; state: string; reason: string; productSlug?: string | null }[];
  rows: { url: string; product?: string | null; name?: string | null }[];
  batchId: string | null;
  maximum: number;
};

type BatchRow = {
  id: string;
  source_filename: string | null;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
  created_by_email: string | null;
  committed_at: string | null;
  rows_taken: number;
  assigned: number;
  unresolved: number;
  investigated: number;
  pending: number;
  fetch_failed: number;
  errors: number;
};

async function post<T>(body: Record<string, unknown>, path = "/api/demo/assign"): Promise<T> {
  const { authHeaders } = await import("@/lib/auth/operator-fetch");
  const response = await fetch(path, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    // A refusal carries a code and, for the size rule, both numbers - so the
    // operator is told what to do rather than that something went wrong.
    const code = String(payload.error ?? "the request was refused");
    const detail = payload.message ? ` ${String(payload.message)}` : "";
    throw new Error(`${code}:${detail}`.trim());
  }
  return payload as T;
}

const STATUS_TONE: Record<string, string> = {
  COMMITTED: "text-emerald-300 border-emerald-500/40",
  PARTIALLY_COMPLETED: "text-amber-300 border-amber-500/40",
  PREVIEW_READY: "text-sky-300 border-sky-500/40",
  PROCESSING: "text-sky-300 border-sky-500/40",
  FAILED: "text-rose-300 border-rose-500/40",
  CANCELLED: "text-slate-400 border-slate-600/40",
};

export function OpsBatchPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const batches = useQuery({
    queryKey: ["demo-batches"],
    queryFn: () => post<{ batches: BatchRow[] }>({ action: "batches", limit: 25 }),
    refetchInterval: 30_000,
  });

  const readFile = async (file: File) => {
    setFilename(file.name);
    setText(await file.text());
    setPreview(null);
    setRefusal(null);
  };

  const runPreview = async () => {
    if (!text.trim()) {
      // i18n-ignore - the operator console reports the states the API returns.
      toast.error("Choose a file, or paste the addresses.");
      return;
    }
    setBusy("preview");
    setRefusal(null);
    try {
      const result = await post<PreviewResult>({ action: "file-preview", text, filename });
      setPreview(result);
      toast.success(`Batch read: ${result.counts.VALID} of ${result.counts.TOTAL} usable`, {
        description: "Nothing has been written. Commit it to take these addresses in.",
      });
      await qc.invalidateQueries({ queryKey: ["demo-batches"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreview(null);
      setRefusal(message);
      // i18n-ignore - the operator console reports the states the API returns.
      toast.error("The file was refused", { description: message });
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!preview?.batchId) return;
    setBusy("commit");
    try {
      const result = await post<{ status: string; totals: Record<string, number> }>({
        action: "commit",
        batchId: preview.batchId,
        rows: preview.rows,
      });
      const totals = Object.entries(result.totals)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} ${n}`)
        .join(" · ");
      toast.success(`Batch ${result.status.toLowerCase().replace(/_/g, " ")}`, { description: totals });
      setPreview(null);
      setText("");
      setFilename(null);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["demo-batches"] });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRefusal(message);
      // i18n-ignore - the operator console reports the states the API returns.
      toast.error("The batch was not committed", { description: message });
    } finally {
      setBusy(null);
    }
  };

  const investigate = async (batch: BatchRow, retryFailed: boolean) => {
    setBusy(batch.id);
    try {
      const result = await post<{ totals: Record<string, number>; remainingPending: number }>(
        {
          action: "commit",
          batchId: batch.id,
          limit: 100,
          retryFailed,
        },
        "/api/demo/investigate",
      );
      const totals = Object.entries(result.totals)
        .map(([k, n]) => `${k} ${n}`)
        .join(" · ");
      toast.success(retryFailed ? "Retried the failures" : "Investigated", {
        description: `${totals || "nothing was due"}${result.remainingPending ? ` · ${result.remainingPending} still waiting` : ""}`,
      });
      await qc.invalidateQueries({ queryKey: ["demo-batches"] });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // i18n-ignore - the operator console reports the states the API returns.
      toast.error("The investigation was refused", { description: message });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (batch: BatchRow) => {
    setBusy(batch.id);
    try {
      await post({ action: "cancel", batchId: batch.id });
      // i18n-ignore - the operator console reports the states the API returns.
      toast.success("Batch cancelled", { description: "No demo was touched." });
      await qc.invalidateQueries({ queryKey: ["demo-batches"] });
    } catch (error) {
      // i18n-ignore - the operator console reports the states the API returns.
      toast.error("Could not cancel it", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const rows = batches.data?.batches ?? [];

  return (
    // The operations console is the operator's own screen and is not
    // translated: the states it names are the states the API returns.
    <div className="space-y-4" data-no-translate>
      <OpsSection
        icon={Upload}
        title="Take a batch in"
        description="Up to 500 addresses at a time. The file is read and decided before anything is written, and a larger file is refused rather than cut short."
        badge={filename ?? "no file"}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
              className="text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
            />
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={busy === "preview"}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
            >
              {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Preview
            </button>
            {preview?.batchId && (
              <button
                type="button"
                onClick={() => void commit()}
                disabled={busy === "commit" || preview.counts.VALID === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-50"
              >
                {busy === "commit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Commit {preview.counts.VALID}
              </button>
            )}
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
              setRefusal(null);
            }}
            rows={5}
            spellCheck={false}
            placeholder={"url,product_name\nhttps://example.com/,CounterPOS"}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200"
          />

          {refusal && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-200">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {refusal}
            </p>
          )}

          {preview && (
            <div className="space-y-2 rounded-lg border border-slate-800 p-3">
              <p className="text-xs text-slate-400">{preview.detected.join(" · ")}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.counts)
                  .filter(([, n]) => n > 0)
                  .map(([key, n]) => (
                    <span
                      key={key}
                      className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300"
                    >
                      {key.toLowerCase().replace(/_/g, " ")} {n}
                    </span>
                  ))}
              </div>
              {preview.invalid.length > 0 && (
                <ul className="space-y-1 text-[11px] text-amber-200/80">
                  {preview.invalid.slice(0, 5).map((row) => (
                    <li key={`${row.line}-${row.sample}`}>
                      line {row.line}: {row.reason} — {row.sample}
                    </li>
                  ))}
                </ul>
              )}
              <ul className="space-y-1 text-[11px] text-slate-400">
                {preview.sample.slice(0, 5).map((row) => (
                  <li key={row.url} className="truncate">
                    <span className="font-mono text-slate-300">{row.state}</span> {row.url} — {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </OpsSection>

      <OpsSection
        icon={Boxes}
        title="Batch history"
        description="Every upload, with its progress counted from the rows themselves - so an interrupted run shows what has actually been done."
        badge={`${rows.length} batches`}
      >
        {batches.isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the batches
          </p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No batch has been taken in yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {rows.map((batch) => (
              <li key={batch.id} className="space-y-2 p-4" data-batch={batch.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {batch.source_filename ?? "pasted addresses"}
                      <span className="ml-2 font-mono text-[10px] text-slate-500">{batch.id.slice(0, 8)}</span>
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {new Date(batch.created_at).toLocaleString()} · {batch.created_by_email ?? "unknown"} ·{" "}
                      {batch.total_rows} in the file
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] ${STATUS_TONE[batch.status] ?? "border-slate-700 text-slate-300"}`}
                  >
                    {batch.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                  <span>taken in {batch.rows_taken}</span>
                  <span>assigned {batch.assigned}</span>
                  <span>unresolved {batch.unresolved}</span>
                  <span>investigated {batch.investigated}</span>
                  <span>waiting {batch.pending}</span>
                  {batch.fetch_failed > 0 && <span className="text-amber-300">fetch failed {batch.fetch_failed}</span>}
                  {batch.errors > 0 && <span className="text-rose-300">errors {batch.errors}</span>}
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-emerald-500/70"
                    style={{
                      width: `${batch.rows_taken ? Math.round(((batch.rows_taken - batch.pending) / batch.rows_taken) * 100) : 0}%`,
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === batch.id || batch.pending === 0}
                    onClick={() => void investigate(batch, false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                  >
                    {busy === batch.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Investigate {batch.pending || ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy === batch.id || batch.fetch_failed + batch.errors === 0}
                    onClick={() => void investigate(batch, true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-40"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Retry {batch.fetch_failed + batch.errors || ""}
                  </button>
                  {batch.status === "PREVIEW_READY" && (
                    <button
                      type="button"
                      disabled={busy === batch.id}
                      onClick={() => void cancel(batch)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>
    </div>
  );
}

export default OpsBatchPanel;
