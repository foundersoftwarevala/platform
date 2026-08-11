import { ArrowUpRight, Building2, Plus, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { BarChart, DonutChart, LineChart } from "@/components/charts/Charts";
import { useFranchise, MONTHS } from "@/lib/franchise-store";
import { fmtMoney } from "@/lib/metrics";

export function FranchiseHome({ onOpen }: { onOpen: (moduleKey: string) => void }) {
  const { branches, leads, employees, payments } = useFranchise();

  const totalRevenue = branches.reduce((s, b) => s + b.monthlyRevenue, 0);
  const pipeline = leads.filter((l) => l.stage !== "won" && l.stage !== "lost").reduce((s, l) => s + l.value, 0);
  const revenueTrend = MONTHS.map((m, i) => ({
    label: m,
    value: branches.reduce((s, b) => s + (b.trend[i] ?? 0), 0) * 900,
  }));
  const byRegion = Object.entries(
    branches.reduce<Record<string, number>>((acc, b) => {
      acc[b.region] = (acc[b.region] ?? 0) + b.monthlyRevenue;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));
  const topBranches = [...branches].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).slice(0, 6);

  const quickActions = [
    { label: "Add branch", icon: Building2, module: "branches" },
    { label: "New lead", icon: UserPlus, module: "leads" },
    { label: "Hire employee", icon: Users, module: "employees" },
    { label: "Revenue report", icon: Wallet, module: "revenue" },
  ];

  const activity = [
    ...payments.slice(0, 4).map((p) => ({
      id: p.id, when: p.date, text: `Invoice ${p.invoice} • ${fmtMoney(p.amount)} — ${p.status}`, module: "payments",
    })),
    ...leads.slice(0, 4).map((l) => ({
      id: l.id, when: l.createdAt, text: `Lead ${l.company} moved to ${l.stage} • ${fmtMoney(l.value)}`, module: "leads",
    })),
  ].sort((a, b) => +new Date(b.when) - +new Date(a.when)).slice(0, 6);

  return (
    <div className="space-y-4 ams-cascade">
      <div className="flex flex-wrap gap-2">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => onOpen(a.module)}
            className="press-3d inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium depth-3d hover:border-brand/60"
          >
            <a.icon className="h-3.5 w-3.5 text-brand" /> {a.label}
            <Plus className="h-3 w-3 opacity-60" />
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Network revenue</div>
              <div className="text-xs text-muted-foreground">Monthly run-rate {fmtMoney(totalRevenue)}</div>
            </div>
            <button onClick={() => onOpen("revenue")} className="press-3d inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:border-brand/60">
              Details <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-3">
            <LineChart data={revenueTrend} height={200} format={fmtMoney} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Revenue by region</div>
          <div className="mt-2">
            <DonutChart data={byRegion} size={190} format={fmtMoney} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Branch performance</div>
            <button onClick={() => onOpen("branches")} className="text-xs text-muted-foreground hover:text-foreground">View all {branches.length}</button>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {topBranches.map((b) => {
              const pct = Math.min(100, Math.round((b.monthlyRevenue / Math.max(1, b.target)) * 100));
              return (
                <button
                  key={b.id}
                  onClick={() => onOpen("branches")}
                  className="text-left rounded-2xl border border-border bg-card p-3 depth-3d sheen-3d hover:border-brand/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{b.name}</div>
                      <div className="text-[11px] text-muted-foreground">{b.city} • {b.region}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${
                      b.status === "active" ? "bg-success/15 text-success" : b.status === "paused" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
                    }`}>{b.status}</span>
                  </div>
                  <div className="mt-2 text-lg font-black tracking-tight">{fmtMoney(b.monthlyRevenue)}</div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{pct}% of target</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{b.employees}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Pipeline</div>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="mt-1 text-xl font-black">{fmtMoney(pipeline)}</div>
            <div className="mt-3">
              <BarChart
                height={120}
                format={(v) => `${v}`}
                data={["new", "contacted", "qualified", "proposal", "won"].map((s) => ({
                  label: s.slice(0, 4), value: leads.filter((l) => l.stage === s).length,
                }))}
              />
            </div>
            <button onClick={() => onOpen("leads")} className="press-3d mt-3 w-full rounded-lg border border-border py-1.5 text-xs hover:border-brand/60">Open pipeline</button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
            <div className="text-sm font-semibold">Recent activity</div>
            <ul className="mt-2 space-y-2">
              {activity.map((a) => (
                <li key={a.id}>
                  <button onClick={() => onOpen(a.module)} className="w-full text-left group">
                    <div className="text-xs text-foreground/90 group-hover:text-brand transition">{a.text}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(a.when).toLocaleDateString()}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] text-muted-foreground">{employees.length} employees across {branches.length} branches</div>
          </div>
        </div>
      </div>
    </div>
  );
}