import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  History,
  Lock,
  Mail,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { Tabs, SectionCard, StatusBadge } from "@/components/affiliate/StatusBadge";
import { KpiCard, KpiGrid } from "@/components/affiliate/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATASETS, downloadCsv, type DatasetSpec } from "@/lib/affiliate-bulk";
import { EmptyState } from "@/components/affiliate/EmptyState";

export const Route = createFileRoute("/affiliate-manager/export")({
  head: () => ({ meta: [{ title: "Export Center — Affiliate Manager" }] }),
  component: ExportCenter,
});

function ExportCenter() {
  const [datasetId, setDatasetId] = useState<DatasetSpec["id"]>("affiliates");
  const dataset = useMemo(() => DATASETS.find((d) => d.id === datasetId)!, [datasetId]);
  const [columns, setColumns] = useState<string[]>(dataset.exportColumns);
  const [format, setFormat] = useState<"csv" | "xlsx" | "json">("csv");

  function toggleColumn(c: string) {
    setColumns((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  function pickDataset(id: DatasetSpec["id"]) {
    setDatasetId(id);
    const d = DATASETS.find((x) => x.id === id)!;
    setColumns(d.exportColumns);
  }

  function runExport() {
    const header = columns.join(",");
    const sample = columns.map(() => "").join(",");
    const ext = format === "xlsx" ? "xlsx.csv" : format;
    downloadCsv(`${dataset.id}-export.${ext}`, `${header}\n${sample}\n`);
  }

  return (
    <>
      <PageHeader
        title="Export Center"
        description="Export affiliates, links, codes, campaigns, commissions and payouts as CSV, XLSX or JSON with column selection, filters, scheduling and delivery."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Export Center" }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/affiliate-manager/import">
                <UploadCloud className="size-3.5" /> Import Center
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={runExport}>
              <Download className="size-3.5" /> Run Export
            </Button>
          </>
        }
      />
      <Tabs items={["New Export", "Scheduled", "History", "Delivery", "API"]} />
      <WallShell>
        <KpiGrid>
          <KpiCard label="Datasets" value={DATASETS.length.toString()} icon={<FileSpreadsheet className="size-4" />} tone="primary" />
          <KpiCard label="Exports 30d" value="0" icon={<History className="size-4" />} />
          <KpiCard label="Scheduled" value="0" icon={<Calendar className="size-4" />} />
          <KpiCard label="Rows Delivered" value="0" />
          <KpiCard label="Avg. Size" value="—" />
          <KpiCard label="Encryption" value="AES-256" icon={<Lock className="size-4" />} tone="success" />
        </KpiGrid>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <SectionCard title="1. Dataset">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DATASETS.map((d) => {
                  const active = d.id === datasetId;
                  return (
                    <button
                      key={d.id}
                      onClick={() => pickDataset(d.id)}
                      className={[
                        "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-surface hover:border-border-strong hover:bg-muted/30",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-display text-sm font-semibold">{d.label}</div>
                        {active && <StatusBadge tone="primary">Selected</StatusBadge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{d.exportColumns.length} columns available</div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="2. Columns">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {dataset.exportColumns.map((c) => {
                  const active = columns.includes(c);
                  return (
                    <label
                      key={c}
                      className={[
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]",
                        active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-foreground",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleColumn(c)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="font-mono">{c}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{columns.length} of {dataset.exportColumns.length} columns selected</span>
                <div className="flex gap-2">
                  <button className="hover:text-foreground" onClick={() => setColumns(dataset.exportColumns)}>
                    Select all
                  </button>
                  <span>·</span>
                  <button className="hover:text-foreground" onClick={() => setColumns([])}>
                    Clear
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="3. Filters">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Status">
                  <select className="h-9 w-full rounded-md border border-border bg-muted/40 px-2 text-sm">
                    <option>Any</option>
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Suspended</option>
                  </select>
                </Field>
                <Field label="Country">
                  <Input className="h-9 bg-muted/40" placeholder="Any country" />
                </Field>
                <Field label="Created from">
                  <Input type="date" className="h-9 bg-muted/40" />
                </Field>
                <Field label="Created to">
                  <Input type="date" className="h-9 bg-muted/40" />
                </Field>
                <Field label="Tag contains">
                  <Input className="h-9 bg-muted/40" placeholder="e.g. saas" />
                </Field>
                <Field label="Row limit">
                  <Input className="h-9 bg-muted/40" placeholder="Unlimited" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="4. Format & Delivery">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Format">
                  <div className="flex gap-1.5">
                    {(["csv", "xlsx", "json"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={[
                          "h-9 flex-1 rounded-md border px-2 text-sm font-medium uppercase tracking-wide",
                          format === f
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface text-foreground hover:bg-muted/40",
                        ].join(" ")}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Delivery">
                  <select className="h-9 w-full rounded-md border border-border bg-muted/40 px-2 text-sm">
                    <option>Download now</option>
                    <option>Email link to me</option>
                    <option>Send to S3 bucket</option>
                    <option>POST to webhook</option>
                    <option>SFTP drop</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Calendar className="size-3.5" /> Schedule
                </Button>
                <Button size="sm" className="gap-1.5" onClick={runExport}>
                  <Download className="size-3.5" /> Run Export
                </Button>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-3">
            <SectionCard title="Saved Views">
              <EmptyState
                icon={Filter}
                title="No saved views"
                description="Save your column + filter combinations for one-click reruns and scheduled deliveries."
              />
            </SectionCard>

            <SectionCard title="Security">
              <div className="space-y-2 text-[12px] text-muted-foreground">
                <Row icon={<Lock className="size-3.5" />} text="Files encrypted at rest (AES-256)" />
                <Row icon={<Lock className="size-3.5" />} text="Download links signed and expire in 24h" />
                <Row icon={<Mail className="size-3.5" />} text="Audit log on every export with operator and IP" />
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Export History">
          <EmptyState
            icon={History}
            title="No exports yet"
            description="Completed and scheduled exports appear here with file size, row count and delivery status."
          />
        </SectionCard>
      </WallShell>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
      <span className="text-success">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
