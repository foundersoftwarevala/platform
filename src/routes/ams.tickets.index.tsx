import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { listTickets } from "@/lib/ams/tickets.functions";
import { AMS_STATUSES, AMS_PRIORITIES, STATUS_META, PRIORITY_META, type AmsStatus, type AmsPriority } from "@/lib/ams/tickets.types";

export const Route = createFileRoute("/ams/tickets/")({
  head: () => ({
    meta: [
      { title: "AMS — Tickets" },
      { name: "description", content: "Create, assign, work and close enterprise support tickets across every product." },
      { property: "og:title", content: "AMS — Tickets" },
      { property: "og:description", content: "Create, assign, work and close enterprise support tickets across every product." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AmsListPage,
});

function AmsListPage() {
  const [status, setStatus] = useState<AmsStatus | "all">("all");
  const [priority, setPriority] = useState<AmsPriority | "all">("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ams", "list", status, priority, q],
    queryFn: () => listTickets({ data: { status, priority: priority === "all" ? undefined : priority, q } }),
  });
  const rows = data?.rows ?? [];
  const stats = data?.stats ?? { total: 0 };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker="After Sales Management"
        title="Tickets"
        description="Create, assign, work and close enterprise support tickets across every product."
        actions={
          <Button asChild className="gap-1.5"><Link to="/ams/new"><Plus className="h-4 w-4" /> New ticket</Link></Button>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        {(["total","submitted","assigned","in_progress","waiting_customer","resolved","closed"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setStatus(k === "total" ? "all" : (k as AmsStatus))}
            className={`surface-card px-4 py-3 text-left transition hover:shadow-glow-trophy ${
              (status === "all" && k === "total") || status === k ? "ring-1 ring-trophy/50" : ""
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {k === "total" ? "All" : STATUS_META[k as AmsStatus].label}
            </div>
            <div className="text-2xl font-display font-semibold text-gradient-trophy">{stats[k] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by subject or AMS-…" className="pl-9 h-9" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as AmsStatus | "all")}>
          <SelectTrigger className="h-9 w-44"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {AMS_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as AmsPriority | "all")}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {AMS_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading tickets…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="Create your first AMS ticket to capture an issue, assign it and track resolution."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 w-28">Ticket</th>
                <th className="text-left px-4 py-2.5">Subject</th>
                <th className="text-left px-4 py-2.5 w-32">Priority</th>
                <th className="text-left px-4 py-2.5 w-40">Status</th>
                <th className="text-left px-4 py-2.5 w-40">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link to="/ams/$id" params={{ id: t.id }} className="text-trophy hover:underline">{t.ticket_no}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to="/ams/$id" params={{ id: t.id }} className="font-medium hover:text-trophy">{t.subject}</Link>
                    {t.category && <div className="text-xs text-muted-foreground mt-0.5">{t.category}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[t.priority].tone}`}>
                      {PRIORITY_META[t.priority].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[t.status].tone}`}>
                      {STATUS_META[t.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
