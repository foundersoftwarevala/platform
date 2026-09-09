import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale,
  FileCheck,
  FileMinus,
  Globe,
  FileSpreadsheet,
  CheckCircle,
  Download,
  AlertTriangle,
} from "lucide-react";

import { taxRecordsQuery, invoicesQuery, auditLogsQuery } from "@/lib/finance/queries";
import { useUpdateTaxRecord } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { TaxRecord } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatCurrency, formatDate, formatDateTime } from "@/lib/finance/format";

const VIEW_META: Record<string, { title: string; description: string; taxType?: TaxRecord["tax_type"] }> = {
  tax_gst_vat: { title: "GST / VAT", description: "GST and VAT filings, collections and input credit" },
  tax_tds: { title: "TDS / Withholding", description: "Tax deducted at source filings", taxType: "tds" },
  tax_country_wise: { title: "Country-wise Tax", description: "Tax exposure aggregated by client region" },
  tax_audit_reports: { title: "Audit Ready Reports", description: "Exportable audit trail for compliance review" },
};

function isOverdue(record: TaxRecord) {
  if (record.filing_status === "filed" || record.filing_status === "paid") return false;
  return new Date(record.due_date).getTime() < Date.now();
}

function FilingCalendar({ view }: { view: FinanceView }) {
  const meta = VIEW_META[view] ?? VIEW_META['tax_gst_vat']!;
  const taxState = useQuery(taxRecordsQuery(meta.taxType));
  const invoicesState = useQuery(invoicesQuery());
  const updateTax = useUpdateTaxRecord();
  const [search, setSearch] = useState("");

  const records = useMemo(() => {
    const rows = taxState.data ?? [];
    if (view !== "tax_gst_vat") return rows;
    return rows.filter((r) => r.tax_type === "gst" || r.tax_type === "vat");
  }, [taxState.data, view]);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return r.period.toLowerCase().includes(q) || r.tax_type.toLowerCase().includes(q);
      }),
    [records, search],
  );

  const invoices = invoicesState.data ?? [];
  const gstInvoices = useMemo(() => invoices.filter((i) => i.doc_type === "tax_invoice" || i.gst_number), [invoices]);
  const gstCollected = useMemo(() => gstInvoices.reduce((sum, i) => sum + Number(i.tax_amount), 0), [gstInvoices]);
  const inputCredit = useMemo(
    () => invoices.filter((i) => i.doc_type === "credit_note").reduce((sum, i) => sum + Number(i.tax_amount), 0),
    [invoices],
  );

  const stats = useMemo(() => {
    const collected = records.reduce((sum, r) => sum + Number(r.tax_amount), 0);
    const filed = records.filter((r) => r.filing_status === "filed" || r.filing_status === "paid").reduce((sum, r) => sum + Number(r.tax_amount), 0);
    const pending = records.filter((r) => r.filing_status === "pending").reduce((sum, r) => sum + Number(r.tax_amount), 0);
    const overdueCount = records.filter(isOverdue).length;
    const complianceRate = records.length ? ((records.length - overdueCount) / records.length) * 100 : 100;
    return { collected, filed, pending, overdueCount, complianceRate };
  }, [records]);

  return (
    <SectionShell title={meta.title} description={meta.description} icon={Scale}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Tax Collected" value={formatCurrency(stats.collected)} icon={Scale} tone="info" />
          <StatCard label="Filed / Paid" value={formatCurrency(stats.filed)} icon={FileCheck} tone="success" />
          <StatCard label="Pending Filing" value={formatCurrency(stats.pending)} icon={FileMinus} tone="warning" />
          <StatCard label="Compliance Rate" value={`${stats.complianceRate.toFixed(1)}%`} icon={CheckCircle} tone={stats.overdueCount ? "danger" : "success"} />
        </StatGrid>

        {view === "tax_gst_vat" ? (
          <PanelCard title="GST Collected vs Input Credit">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">GST/Tax Invoice Collected</p>
                <p className="mt-1 font-display text-2xl font-semibold text-success">{formatCurrency(gstCollected)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{gstInvoices.length} tax invoices</p>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Input Credit (Credit Notes)</p>
                <p className="mt-1 font-display text-2xl font-semibold text-warning">{formatCurrency(inputCredit)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Net liability: {formatCurrency(gstCollected - inputCredit)}</p>
              </div>
            </div>
          </PanelCard>
        ) : null}

        <PanelCard
          title="Filing Calendar"
          actions={<Input placeholder="Search period or type…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />}
        >
          <QueryState isLoading={taxState.isLoading} error={taxState.error} isEmpty={!filtered.length} emptyLabel="No tax records found">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Period</th>
                    <th className="pb-3 font-medium">Taxable Amount</th>
                    <th className="pb-3 font-medium">Tax Amount</th>
                    <th className="pb-3 font-medium">Due Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((record) => {
                    const overdue = isOverdue(record);
                    return (
                      <tr key={record.id} className={overdue ? "bg-destructive/5" : undefined}>
                        <td className="py-3"><StatusBadge status={record.tax_type} /></td>
                        <td className="py-3 text-foreground">{record.period}</td>
                        <td className="py-3 text-muted-foreground">{formatCurrency(record.taxable_amount)}</td>
                        <td className="py-3 font-semibold text-foreground">{formatCurrency(record.tax_amount)}</td>
                        <td className={`py-3 ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                          {overdue ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}
                          {formatDate(record.due_date)}
                        </td>
                        <td className="py-3"><StatusBadge status={overdue ? "overdue" : record.filing_status} /></td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {record.filing_status === "pending" || overdue ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateTax.isPending}
                                onClick={() => updateTax.mutate({ id: record.id, status: "filed" })}
                              >
                                Mark Filed
                              </Button>
                            ) : null}
                            {record.filing_status === "filed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateTax.isPending}
                                onClick={() => updateTax.mutate({ id: record.id, status: "paid" })}
                              >
                                Mark Paid
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}

function CountryWiseTax() {
  const taxState = useQuery(taxRecordsQuery());
  const invoicesState = useQuery(invoicesQuery());

  const countries = useMemo(() => {
    const invoices = invoicesState.data ?? [];
    const map = new Map<string, { count: number; collected: number }>();
    invoices.forEach((inv) => {
      const key = inv.client_type || "unknown";
      const entry = map.get(key) ?? { count: 0, collected: 0 };
      entry.count += 1;
      entry.collected += Number(inv.tax_amount);
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([clientType, v]) => ({ clientType, ...v }))
      .sort((a, b) => b.collected - a.collected);
  }, [invoicesState.data]);

  const totalCollected = useMemo(() => (taxState.data ?? []).reduce((sum, r) => sum + Number(r.tax_amount), 0), [taxState.data]);

  return (
    <SectionShell title="Country-wise Tax" description="Tax exposure aggregated by client segment (region data derived from invoices)" icon={Globe}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Tax Collected" value={formatCurrency(totalCollected)} icon={Scale} tone="info" />
          <StatCard label="Segments Tracked" value={countries.length} icon={Globe} />
          <StatCard label="Invoices Analyzed" value={(invoicesState.data ?? []).length} icon={FileSpreadsheet} />
          <StatCard label="Tax Records" value={(taxState.data ?? []).length} icon={FileCheck} />
        </StatGrid>

        <PanelCard title="Client Segment Tax Overview">
          <QueryState isLoading={invoicesState.isLoading} error={invoicesState.error} isEmpty={!countries.length} emptyLabel="No invoice data yet">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Client Type</th>
                    <th className="pb-3 font-medium">Invoices</th>
                    <th className="pb-3 font-medium">Tax Collected</th>
                    <th className="pb-3 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {countries.map((c) => (
                    <tr key={c.clientType}>
                      <td className="py-3 font-medium capitalize text-foreground">{c.clientType.replace(/_/g, " ")}</td>
                      <td className="py-3 text-muted-foreground">{c.count}</td>
                      <td className="py-3 font-semibold text-foreground">{formatCurrency(c.collected)}</td>
                      <td className="py-3 text-muted-foreground">
                        {totalCollected ? `${((c.collected / totalCollected) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}

function AuditReports() {
  const auditState = useQuery(auditLogsQuery());
  const taxState = useQuery(taxRecordsQuery());

  const rows = auditState.data ?? [];
  const financeRelated = useMemo(
    () => rows.filter((r) => r.entity.toLowerCase().includes("tax") || r.entity.toLowerCase().includes("finance") || r.entity.toLowerCase().includes("invoice")),
    [rows],
  );

  const exportRows = financeRelated.length ? financeRelated : rows;

  return (
    <SectionShell
      title="Audit Ready Reports"
      description="Full audit trail for tax and finance related actions"
      icon={FileSpreadsheet}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            downloadCsv(
              "finance-audit-report.csv",
              exportRows.map((r) => ({
                entity: r.entity,
                entity_ref: r.entity_ref,
                action: r.action,
                actor: r.actor,
                actor_role: r.actor_role,
                severity: r.severity,
                ip_address: r.ip_address,
                created_at: r.created_at,
              })),
            )
          }
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Audit Entries" value={rows.length} icon={FileSpreadsheet} />
          <StatCard label="Finance/Tax Entries" value={financeRelated.length} tone="info" />
          <StatCard label="Critical Severity" value={rows.filter((r) => r.severity === "critical").length} tone="danger" />
          <StatCard label="Tax Records" value={(taxState.data ?? []).length} tone="success" />
        </StatGrid>

        <PanelCard title="Audit Log">
          <QueryState isLoading={auditState.isLoading} error={auditState.error} isEmpty={!exportRows.length} emptyLabel="No audit entries yet">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Entity</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Actor</th>
                    <th className="pb-3 font-medium">Severity</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exportRows.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 font-medium text-foreground">{r.entity} {r.entity_ref ? <span className="text-xs text-muted-foreground">#{r.entity_ref}</span> : null}</td>
                      <td className="py-3 text-muted-foreground">{r.action}</td>
                      <td className="py-3 text-muted-foreground">{r.actor} ({r.actor_role})</td>
                      <td className="py-3"><StatusBadge status={r.severity} /></td>
                      <td className="py-3 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}

export default function TaxSections({ view }: { view: FinanceView }) {
  if (view === "tax_country_wise") return <CountryWiseTax />;
  if (view === "tax_audit_reports") return <AuditReports />;
  return <FilingCalendar view={view} />;
}
