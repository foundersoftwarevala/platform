import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart2, Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { KpiCard, KpiGrid } from "@/components/affiliate/KpiCard";
import { SectionCard } from "@/components/affiliate/StatusBadge";
import { Button } from "@/components/ui/button";

const REPORTS = [
  { name: "Affiliate Report", desc: "Every affiliate with performance, health, commissions and status." },
  { name: "Commission Report", desc: "All commissions grouped by period, plan and status." },
  { name: "Revenue Report", desc: "Attributed revenue by affiliate, campaign, country and period." },
  { name: "Sales Report", desc: "Completed sales, refunds and net revenue by product." },
  { name: "Campaign Report", desc: "Campaign performance across affiliates, budget and ROI." },
  { name: "Payout Report", desc: "All payouts with method, currency, status and audit trail." },
  { name: "Traffic Report", desc: "Clicks, conversions, CTR, top links and top codes." },
];

export const Route = createFileRoute("/affiliate-manager/reports")({
  head: () => ({ meta: [{ title: "Reports — Affiliate Manager" }] }),
  component: () => (
    <>
      <PageHeader
        title="Reports"
        description="Enterprise reports with PDF, Excel and CSV export across every workspace."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Reports" }]}
        actions={<Button size="sm"><Download className="mr-1 size-4" /> Export All</Button>}
      />
      <WallShell>
        <KpiGrid>
          <KpiCard label="Report Types" value={String(REPORTS.length)} icon={<FileBarChart2 className="size-4" />} tone="primary" />
          <KpiCard label="Formats" value="PDF · XLSX · CSV" icon={<FileSpreadsheet className="size-4" />} />
          <KpiCard label="Schedules" value="Daily · Weekly · Monthly" />
        </KpiGrid>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {REPORTS.map((r) => (
            <SectionCard key={r.name} title={r.name} action={<FileText className="size-4 text-muted-foreground" />}>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline">PDF</Button>
                <Button size="sm" variant="outline">Excel</Button>
                <Button size="sm" variant="outline">CSV</Button>
                <Button size="sm" variant="ghost">Schedule</Button>
              </div>
            </SectionCard>
          ))}
        </div>
      </WallShell>
    </>
  ),
});
