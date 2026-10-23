import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileBarChart, Play, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

import {
  listResellerReports,
  runResellerReport,
  saveResellerReport,
} from "@/lib/reseller-reports.functions";

type ReportType = "sales" | "commissions";
type ReportResult = {
  columns: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  totalsByCurrency: { currency: string; grossAmount: number; commissionAmount: number }[];
};

type Draft = {
  name: string;
  type: ReportType;
  fromDate: string;
  toDate: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => `${today().slice(0, 7)}-01`;
const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-wait disabled:opacity-50";

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function downloadCsv(name: string, result: ReportResult) {
  const csv = [
    result.columns.map(csvCell).join(","),
    ...result.rows.map((row) => result.columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    name
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "reseller-report"
  }.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ResellerReports() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["reseller-manager-reports"],
    queryFn: () => listResellerReports(),
  });
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    type: "sales",
    fromDate: startOfMonth(),
    toDate: today(),
  });
  const [runningId, setRunningId] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: (value: Draft) => saveResellerReport({ data: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reseller-manager-reports"] });
      setCreating(false);
      setDraft({ name: "", type: "sales", fromDate: startOfMonth(), toDate: today() });
      toast.success(t("reseller.report_saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function run(id: string) {
    setRunningId(id);
    try {
      await runResellerReport({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["reseller-manager-reports"] });
      toast.success(t("reseller.report_run_saved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reseller.report_run_failed"),
      );
    } finally {
      setRunningId(null);
    }
  }

  return (
    <section className="space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("reseller.reports_kicker")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" /> {t("reseller.reports_title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("reseller.reports_description")}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => setCreating((value) => !value)}
        >
          <Plus className="h-4 w-4" /> {t("reseller.new_report")}
        </button>
      </header>

      {creating && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(draft);
          }}
        >
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("reseller.report_name")}</span>
            <input
              className={fieldClass}
              maxLength={120}
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("reseller.report_data")}</span>
            <select
              className={fieldClass}
              value={draft.type}
              onChange={(event) =>
                setDraft({ ...draft, type: event.currentTarget.value as ReportType })
              }
            >
              <option value="sales">{t("reseller.reseller_sales")}</option>
              <option value="commissions">{t("reseller.commissions")}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("reseller.from")}</span>
            <input
              className={fieldClass}
              type="date"
              required
              max={draft.toDate}
              value={draft.fromDate}
              onChange={(event) => setDraft({ ...draft, fromDate: event.currentTarget.value })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("reseller.to")}</span>
            <input
              className={fieldClass}
              type="date"
              required
              min={draft.fromDate}
              max={today()}
              value={draft.toDate}
              onChange={(event) => setDraft({ ...draft, toDate: event.currentTarget.value })}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? t("reseller.saving") : t("reseller.save")}
            </button>
            <button type="button" className={buttonClass} onClick={() => setCreating(false)}>
              {t("reseller.cancel")}
            </button>
          </div>
        </form>
      )}

      {reports.isPending ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("reseller.loading_reports")}
        </div>
      ) : reports.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive"
        >
          {t("reseller.reports_load_failed", { error: reports.error.message })}
        </div>
      ) : reports.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <FileBarChart className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{t("reseller.no_reports_saved")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("reseller.save_report_guidance")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("reseller.report")}</th>
                <th className="px-4 py-3 font-semibold">{t("reseller.type")}</th>
                <th className="px-4 py-3 font-semibold">{t("reseller.date_range")}</th>
                <th className="px-4 py-3 font-semibold">{t("reseller.last_run")}</th>
                <th className="px-4 py-3 font-semibold">{t("reseller.rows")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("reseller.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.data.map((report) => (
                <tr key={report.id}>
                  <td className="px-4 py-3 font-semibold">{report.name}</td>
                  <td className="px-4 py-3 capitalize">{report.type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {report.fromDate} – {report.toDate}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {report.lastRunAt
                      ? new Date(report.lastRunAt).toLocaleString()
                      : t("reseller.not_run_yet")}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{report.lastResult?.rowCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={runningId === report.id}
                        onClick={() => void run(report.id)}
                      >
                        {runningId === report.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {runningId === report.id
                          ? t("reseller.running")
                          : t("reseller.run_now")}
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={!report.lastResult}
                        onClick={() =>
                          report.lastResult &&
                          downloadCsv(report.name, report.lastResult as ReportResult)
                        }
                      >
                        <Download className="h-3.5 w-3.5" /> {t("reseller.export")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reports.data?.some((report) => report.lastResult) && (
        <p className="text-xs text-muted-foreground">
          {t("reseller.report_export_note")}
        </p>
      )}
    </section>
  );
}
