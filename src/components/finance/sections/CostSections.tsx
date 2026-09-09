import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, Cpu, Megaphone, Headphones, PenTool, Download, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

import { expensesQuery, aiUsageQuery } from "@/lib/finance/queries";
import { useCreateExpense, useUpdateExpense } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { Expense } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCompact, formatCurrency, formatDate, downloadCsv } from "@/lib/finance/format";

const META: Record<string, { category?: Expense["category"]; label: string; icon: typeof Server; description: string }> = {
  cost_server: { category: "server", label: "Server Cost", icon: Server, description: "Infrastructure and hosting expenses" },
  cost_ai_api: { category: "ai_api", label: "AI / API Cost", icon: Cpu, description: "Recorded AI/API vendor expenses" },
  cost_marketing: { category: "marketing", label: "Marketing Cost", icon: Megaphone, description: "Marketing and acquisition spend" },
  cost_support: { category: "support", label: "Support Cost", icon: Headphones, description: "Customer support tooling & staffing costs" },
  cost_manual_entry: { label: "Manual Expense Entry", icon: PenTool, description: "Record a one-off or recurring expense" },
};

const CATEGORY_OPTIONS = ["server", "ai_api", "marketing", "support", "salary", "tools", "misc"];

export default function CostSections({ view }: { view: FinanceView }) {
  const meta = META[view] ?? META["cost_server"]!;
  const expensesState = useQuery(expensesQuery(meta.category));
  const allExpensesState = useQuery(expensesQuery());
  const aiUsageState = useQuery(aiUsageQuery());
  const updateExpense = useUpdateExpense();
  const createExpense = useCreateExpense();
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    category: "server",
    vendor: "",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    recurring: false,
  });

  const rows = expensesState.data ?? [];
  const allRows = allExpensesState.data ?? [];
  const aiRows = aiUsageState.data ?? [];

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((e) => e.vendor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
  }, [rows, search]);

  // Category summary across all categories (for KPI comparison)
  const categorySummary = useMemo(() => {
    const map = new Map<string, { category: string; total: number; count: number }>();
    for (const e of allRows) {
      const entry = map.get(e.category) ?? { category: e.category, total: 0, count: 0 };
      entry.total += Number(e.amount);
      entry.count += 1;
      map.set(e.category, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allRows]);

  const relevantRows = view === "cost_ai_api" ? rows : rows;

  const stats = useMemo(() => {
    const total = relevantRows.reduce((sum, e) => sum + Number(e.amount), 0);
    const recurringTotal = relevantRows.filter((e) => e.recurring).reduce((sum, e) => sum + Number(e.amount), 0);
    const pending = relevantRows.filter((e) => e.status === "pending").length;
    const approved = relevantRows.filter((e) => e.status === "approved").length;
    return { total, recurringTotal, pending, approved };
  }, [relevantRows]);

  // Monthly trend from expense_date
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of relevantRows) {
      const key = e.expense_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));
  }, [relevantRows]);

  // Vendor breakdown
  const vendorBreakdown = useMemo(() => {
    const map = new Map<string, { vendor: string; total: number; count: number; recurring: boolean }>();
    for (const e of relevantRows) {
      const entry = map.get(e.vendor) ?? { vendor: e.vendor, total: 0, count: 0, recurring: e.recurring };
      entry.total += Number(e.amount);
      entry.count += 1;
      map.set(e.vendor, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [relevantRows]);

  const aiTotalCost = useMemo(() => aiRows.reduce((sum, u) => sum + Number(u.cost), 0), [aiRows]);

  const handleExport = () => {
    downloadCsv(`${view}.csv`, filteredRows.map((e) => ({
      id: e.id,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amount: e.amount,
      expense_date: e.expense_date,
      recurring: e.recurring,
      status: e.status,
    })));
  };

  const handleSubmit = () => {
    const amount = Number(form.amount);
    if (!form.vendor || !form.description || !amount || amount <= 0) {
      toast.error("Fill in vendor, description and a valid amount");
      return;
    }
    createExpense.mutate(
      {
        category: form.category,
        vendor: form.vendor,
        description: form.description,
        amount,
        expenseDate: form.expenseDate,
        recurring: form.recurring,
        actor: "finance_manager",
      },
      {
        onSuccess: () => setForm({ category: "server", vendor: "", description: "", amount: "", expenseDate: new Date().toISOString().slice(0, 10), recurring: false }),
      },
    );
  };

  const Icon = meta.icon;

  return (
    <SectionShell
      title={meta.label}
      description={meta.description}
      icon={Icon}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          {categorySummary.slice(0, 4).map((c) => (
            <StatCard
              key={c.category}
              label={c.category.replace(/_/g, " ")}
              value={formatCompact(c.total)}
              hint={`${c.count} entries`}
              icon={c.category === view.replace("cost_", "") ? Icon : TrendingUp}
              tone={c.category === meta.category ? "default" : "info"}
            />
          ))}
        </StatGrid>

        {view === "cost_manual_entry" && (
          <PanelCard title="Add Manual Expense">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Vendor</label>
                <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Enter vendor name" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Amount</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
                <Input type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Expense description..." />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                />
                <label htmlFor="recurring" className="text-sm text-foreground">Recurring expense</label>
              </div>
            </div>
            <Button className="mt-4 gap-2" disabled={createExpense.isPending} onClick={handleSubmit}>
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </PanelCard>
        )}

        <PanelCard title="Monthly Trend">
          <QueryState isLoading={expensesState.isLoading} error={expensesState.error} isEmpty={monthlyTrend.length === 0} emptyLabel="No spend data yet">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-primary, #6366f1)" fill="var(--color-primary, #6366f1)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard title="Vendor Breakdown">
          <QueryState isLoading={expensesState.isLoading} error={expensesState.error} isEmpty={vendorBreakdown.length === 0} emptyLabel="No vendors yet">
            <div className="space-y-2">
              {vendorBreakdown.map((v) => (
                <div key={v.vendor} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{v.vendor}</span>
                    {v.recurring && <Badge variant="outline" className="text-[10px]">Recurring</Badge>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{v.count} entries</span>
                    <span className="font-semibold text-foreground">{formatCompact(v.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>

        {view === "cost_ai_api" && (
          <PanelCard title="AI/API Usage Cost (finance_ai_api_usage)">
            <QueryState isLoading={aiUsageState.isLoading} error={aiUsageState.error} isEmpty={aiRows.length === 0}>
              <p className="text-sm text-muted-foreground">
                Total metered AI/API usage cost across all providers: <span className="font-semibold text-foreground">{formatCurrency(aiTotalCost)}</span>
              </p>
            </QueryState>
          </PanelCard>
        )}

        <PanelCard
          title="Expense Log"
          actions={
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor or description..."
              className="h-8 w-56 rounded-md border border-border bg-background px-2 text-xs"
            />
          }
        >
          <QueryState isLoading={expensesState.isLoading} error={expensesState.error} isEmpty={filteredRows.length === 0} emptyLabel="No expenses found">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Vendor</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Recurring</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 font-medium text-foreground">{e.vendor}</td>
                      <td className="py-2 text-muted-foreground">{e.description}</td>
                      <td className="py-2 font-semibold text-destructive">{formatCurrency(e.amount)}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(e.expense_date)}</td>
                      <td className="py-2">
                        <Badge variant={e.recurring ? "default" : "secondary"} className="text-xs">{e.recurring ? "Yes" : "No"}</Badge>
                      </td>
                      <td className="py-2"><StatusBadge status={e.status} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {e.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updateExpense.isPending}
                                onClick={() => updateExpense.mutate({ id: e.id, status: "approved", actor: "finance_manager" })}>
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" disabled={updateExpense.isPending}
                                onClick={() => updateExpense.mutate({ id: e.id, status: "rejected", actor: "finance_manager" })}>
                                Reject
                              </Button>
                            </>
                          )}
                          {e.status === "approved" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updateExpense.isPending}
                              onClick={() => updateExpense.mutate({ id: e.id, status: "reimbursed", actor: "finance_manager" })}>
                              Reimburse
                            </Button>
                          )}
                        </div>
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
