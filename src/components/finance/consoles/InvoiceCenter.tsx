import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Download, FileText, Plus, Search, Send, Trash2, XCircle } from "lucide-react";

import { invoicesQuery } from "@/lib/finance/queries";
import { useCreateInvoice, useUpdateInvoice } from "@/lib/finance/mutations";
import type { Invoice } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, formatCurrency, formatDate } from "@/lib/finance/format";

type LineItemDraft = { description: string; qty: number; rate: number };

function GenerateInvoiceDialog() {
  const createInvoice = useCreateInvoice();
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState("business");
  const [docType, setDocType] = useState<"invoice" | "credit_note" | "debit_note" | "tax_invoice">("invoice");
  const [gstNumber, setGstNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxPercent, setTaxPercent] = useState(18);
  const [items, setItems] = useState<LineItemDraft[]>([{ description: "", qty: 1, rate: 0 }]);

  const updateItem = (idx: number, patch: Partial<LineItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const canSubmit =
    clientName.trim().length > 0 &&
    dueDate.trim().length > 0 &&
    items.every((it) => it.description.trim().length > 0 && it.qty > 0 && it.rate >= 0);

  const reset = () => {
    setClientName("");
    setGstNumber("");
    setDueDate("");
    setTaxPercent(18);
    setItems([{ description: "", qty: 1, rate: 0 }]);
  };

  const submit = () => {
    if (!canSubmit) return;
    createInvoice.mutate(
      {
        clientName: clientName.trim(),
        clientType,
        docType,
        gstNumber: gstNumber.trim() || undefined,
        dueDate,
        taxPercent,
        lineItems: items,
        actor: "finance_manager",
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Generate Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
            </div>
            <div className="space-y-1.5">
              <Label>Client Type</Label>
              <Select value={clientType} onValueChange={setClientType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="franchise">Franchise</SelectItem>
                  <SelectItem value="reseller">Reseller</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as typeof docType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="tax_invoice">Tax Invoice</SelectItem>
                  <SelectItem value="credit_note">Credit Note</SelectItem>
                  <SelectItem value="debit_note">Debit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>GST/VAT Number (optional)</Label>
              <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="GSTIN..." />
            </div>
            <div className="space-y-1.5">
              <Label>Tax %</Label>
              <Input type="number" min={0} max={100} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { description: "", qty: 1, rate: 0 }])}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_60px_80px_28px] items-center gap-2">
                <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                <Input type="number" min={1} value={item.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                <Input type="number" min={0} value={item.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  disabled={items.length <= 1}
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!canSubmit || createInvoice.isPending} onClick={submit}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InvoiceCenter() {
  const [search, setSearch] = useState("");
  const invoicesState = useQuery(invoicesQuery());
  const updateInvoice = useUpdateInvoice();

  const rows = invoicesState.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((i) => i.invoice_no.toLowerCase().includes(q) || i.client_name.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const paid = rows.filter((i) => i.status === "paid").length;
    const pending = rows.filter((i) => i.status === "unpaid" || i.status === "draft").length;
    const overdue = rows.filter((i) => i.status === "overdue").length;
    return { total, paid, pending, overdue };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv(
      "invoices.csv",
      filtered.map((i) => ({
        invoice_no: i.invoice_no,
        client_name: i.client_name,
        client_type: i.client_type,
        doc_type: i.doc_type,
        subtotal: i.subtotal,
        tax_amount: i.tax_amount,
        total: i.total,
        status: i.status,
        issue_date: i.issue_date,
        due_date: i.due_date,
      })),
    );
  };

  const act = (id: string, status: Invoice["status"]) => updateInvoice.mutate({ id, status, actor: "finance_manager" });

  const statusIcon = (status: string) => {
    if (status === "paid") return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === "overdue" || status === "cancelled") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  return (
    <SectionShell
      title="Invoice Center"
      description="Generate, manage, and track all invoices with GST/VAT support"
      icon={FileText}
      actions={<GenerateInvoiceDialog />}
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Invoices" value={stats.total} icon={FileText} loading={invoicesState.isLoading} />
          <StatCard label="Paid" value={stats.paid} icon={CheckCircle} tone="success" loading={invoicesState.isLoading} />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="warning" loading={invoicesState.isLoading} />
          <StatCard label="Overdue" value={stats.overdue} icon={XCircle} tone="danger" loading={invoicesState.isLoading} />
        </StatGrid>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by invoice number, client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export All
          </Button>
        </div>

        <PanelCard title="All Invoices">
          <QueryState isLoading={invoicesState.isLoading} error={invoicesState.error} isEmpty={filtered.length === 0}>
            <div className="space-y-3">
              {filtered.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 p-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{invoice.invoice_no}</p>
                        {invoice.gst_number ? (
                          <Badge variant="outline" className="text-xs">GST</Badge>
                        ) : null}
                        <Badge variant="outline" className="text-xs capitalize">{invoice.doc_type.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(invoice.issue_date)} • Due {formatDate(invoice.due_date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Subtotal {formatCurrency(invoice.subtotal)}</p>
                      {Number(invoice.tax_amount) > 0 ? (
                        <p className="text-xs text-muted-foreground">Tax {formatCurrency(invoice.tax_amount)}</p>
                      ) : null}
                      <p className="text-lg font-bold text-foreground">{formatCurrency(invoice.total)}</p>
                    </div>

                    <Badge className="flex items-center gap-1" variant="outline">
                      {statusIcon(invoice.status)}
                      <span className="capitalize">{invoice.status}</span>
                    </Badge>

                    <div className="flex items-center gap-1">
                      {invoice.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1" disabled={updateInvoice.isPending} onClick={() => act(invoice.id, "unpaid")}>
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      )}
                      {(invoice.status === "unpaid" || invoice.status === "overdue") && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-success" disabled={updateInvoice.isPending} onClick={() => act(invoice.id, "paid")}>
                          <CheckCircle className="h-3.5 w-3.5" /> Mark Paid
                        </Button>
                      )}
                      {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive" disabled={updateInvoice.isPending} onClick={() => act(invoice.id, "cancelled")}>
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
