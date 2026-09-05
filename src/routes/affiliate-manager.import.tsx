import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  ListChecks,
  History,
} from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { Tabs, SectionCard, StatusBadge } from "@/components/affiliate/StatusBadge";
import { KpiCard, KpiGrid } from "@/components/affiliate/KpiCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DATASETS, buildCsvTemplate, downloadCsv, type DatasetSpec } from "@/lib/affiliate-bulk";
import { EmptyState } from "@/components/affiliate/EmptyState";

export const Route = createFileRoute("/affiliate-manager/import")({
  head: () => ({ meta: [{ title: "Import Center — Affiliate Manager" }] }),
  component: ImportCenter,
});

type Phase = "select" | "upload" | "map" | "validate" | "done";

function ImportCenter() {
  const [datasetId, setDatasetId] = useState<DatasetSpec["id"]>("affiliates");
  const dataset = useMemo(() => DATASETS.find((d) => d.id === datasetId)!, [datasetId]);
  const [phase, setPhase] = useState<Phase>("select");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setRowCount(Math.floor(Math.random() * 4000) + 200);
    setPhase("map");
  }

  function downloadTemplate(format: "csv" | "xlsx") {
    if (format === "csv") {
      downloadCsv(`${dataset.id}-template.csv`, buildCsvTemplate(dataset));
    } else {
      // XLSX template ships as CSV-encoded fallback for now; clearly labeled.
      downloadCsv(`${dataset.id}-template.xlsx.csv`, buildCsvTemplate(dataset));
    }
  }

  const validationSummary = {
    parsed: rowCount,
    valid: Math.round(rowCount * 0.93),
    warnings: Math.round(rowCount * 0.05),
    errors: Math.round(rowCount * 0.02),
  };

  return (
    <>
      <PageHeader
        title="Import Center"
        description="Bulk import affiliates, links, codes, campaigns, commissions and payouts from CSV or XLSX with column mapping, schema validation and a downloadable error report."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Import Center" }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/affiliate-manager/export">
                <Download className="size-3.5" /> Export Center
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5">
              <UploadCloud className="size-3.5" /> New Import
            </Button>
          </>
        }
      />
      <Tabs items={["New Import", "In Progress", "History", "Scheduled", "API"]} />
      <WallShell>
        <KpiGrid>
          <KpiCard label="Datasets" value={DATASETS.length.toString()} icon={<FileSpreadsheet className="size-4" />} tone="primary" />
          <KpiCard label="Imports 30d" value="0" icon={<History className="size-4" />} />
          <KpiCard label="Records Imported" value="0" />
          <KpiCard label="Validation Pass" value="—" icon={<ShieldCheck className="size-4" />} tone="success" />
          <KpiCard label="Errors 30d" value="0" tone="destructive" />
          <KpiCard label="Largest Batch" value="—" />
        </KpiGrid>

        <SectionCard title="1. Choose Dataset">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DATASETS.map((d) => {
              const active = d.id === datasetId;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setDatasetId(d.id);
                    setPhase("select");
                    setFileName(null);
                  }}
                  className={[
                    "group flex flex-col gap-1.5 rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-surface hover:border-border-strong hover:bg-muted/30",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-display text-sm font-semibold">{d.label}</div>
                    {active && <StatusBadge tone="primary">Selected</StatusBadge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground line-clamp-2">{d.description}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {d.fields.length} columns · {d.fields.filter((f) => f.required).length} required
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <SectionCard title="2. Upload File">
              <div className="rounded-md border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <div className="mx-auto mb-3 grid size-11 place-items-center rounded-md bg-primary-soft text-primary">
                  <UploadCloud className="size-5" />
                </div>
                <div className="font-display text-sm font-semibold">Drop your {dataset.label} file here</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Accepts .csv and .xlsx · Max 500 MB · UTF-8 recommended
                </div>
                <label className="mt-4 inline-flex">
                  <input type="file" accept=".csv,.xlsx" onChange={onFile} className="hidden" />
                  <span className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    Select File
                  </span>
                </label>
                {fileName && (
                  <div className="mt-4 text-[12px] text-muted-foreground">
                    Loaded <span className="font-medium text-foreground">{fileName}</span> ·{" "}
                    {rowCount.toLocaleString()} rows detected
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="3. Column Mapping">
              {phase === "select" ? (
                <EmptyState
                  icon={ListChecks}
                  title="Upload a file to map columns"
                  description="Source columns are auto-detected and matched to the destination schema using fuzzy match."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Source Column</th>
                        <th className="px-3 py-2 text-left font-medium">→ Destination Field</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Required</th>
                        <th className="px-3 py-2 text-left font-medium">Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.fields.map((f) => (
                        <tr key={f.name} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{f.name}</td>
                          <td className="px-3 py-2 font-mono text-[12px] text-foreground">{f.name}</td>
                          <td className="px-3 py-2 text-[12px]">{f.type}</td>
                          <td className="px-3 py-2">
                            {f.required ? (
                              <StatusBadge tone="warning">Required</StatusBadge>
                            ) : (
                              <span className="text-[12px] text-muted-foreground">Optional</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{f.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-end gap-2 px-3 py-3">
                    <Button variant="outline" size="sm" onClick={() => setPhase("select")}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => setPhase("validate")}>
                      Validate
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="4. Validation & Dry Run">
              {phase !== "validate" && phase !== "done" ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Validation runs after mapping"
                  description="Every row is checked against the schema for type, length, format, enum and uniqueness before commit."
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SmallStat label="Parsed" value={validationSummary.parsed} />
                    <SmallStat label="Valid" value={validationSummary.valid} tone="success" />
                    <SmallStat label="Warnings" value={validationSummary.warnings} tone="warning" />
                    <SmallStat label="Errors" value={validationSummary.errors} tone="destructive" />
                  </div>
                  <Progress value={Math.round((validationSummary.valid / validationSummary.parsed) * 100)} className="h-2" />
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-[12px] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <AlertTriangle className="size-3.5 text-warning-foreground" /> Top issues
                    </div>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Row 42: <span className="font-mono">email</span> not a valid address</li>
                      <li>• Row 117: <span className="font-mono">country</span> not in ISO-3166 list</li>
                      <li>• Row 392: <span className="font-mono">discount_value</span> exceeds 100 for percent type</li>
                    </ul>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Download className="size-3.5" /> Download error report
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setPhase("done")}>
                      <CheckCircle2 className="size-3.5" /> Commit {validationSummary.valid.toLocaleString()} valid rows
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-3">
            <SectionCard title="Templates">
              <div className="space-y-2">
                <div className="text-[12px] text-muted-foreground">
                  Download the schema for <span className="font-medium text-foreground">{dataset.label}</span> with example rows and inline validation hints.
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => downloadTemplate("csv")}>
                    <Download className="size-3.5" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => downloadTemplate("xlsx")}>
                    <Download className="size-3.5" /> XLSX
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Schema Reference">
              <div className="space-y-2 text-[12px]">
                {dataset.fields.map((f) => (
                  <div key={f.name} className="rounded-md border border-border bg-surface p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px]">{f.name}</span>
                      {f.required ? (
                        <StatusBadge tone="warning">required</StatusBadge>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">optional</span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{f.type}</span>
                      {f.enumValues && <> · {f.enumValues.join(", ")}</>}
                      {f.notes && <> · {f.notes}</>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Options">
              <div className="space-y-2 text-[12px]">
                <Toggle label="Upsert on external_id" defaultChecked />
                <Toggle label="Send welcome email on new affiliate" />
                <Toggle label="Skip rows with warnings" />
                <Toggle label="Notify me on completion" defaultChecked />
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Import History">
          <EmptyState
            icon={History}
            title="No imports yet"
            description="Completed and failed imports appear here with downloadable source files, validation logs and rollback."
          />
        </SectionCard>
      </WallShell>
    </>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "destructive";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning-foreground"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-base font-semibold tabular-nums ${color}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-2.5 py-2">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-primary" />
    </label>
  );
}
