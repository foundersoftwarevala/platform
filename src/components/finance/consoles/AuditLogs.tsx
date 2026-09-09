import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, ScrollText, Search, Shield, User } from "lucide-react";

import { auditLogsQuery } from "@/lib/finance/queries";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, formatDateTime } from "@/lib/finance/format";

export default function AuditLogs() {
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const auditState = useQuery(auditLogsQuery());

  const rows = auditState.data ?? [];

  const severities = useMemo(() => Array.from(new Set(rows.map((r) => r.severity))).sort(), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (severity !== "all") list = list.filter((l) => l.severity === severity);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.entity.toLowerCase().includes(q) ||
          (l.entity_ref ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, severity, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const today = new Date().toISOString().slice(0, 10);
    const todays = rows.filter((l) => l.created_at.slice(0, 10) === today).length;
    const critical = rows.filter((l) => l.severity === "critical").length;
    const automated = rows.filter((l) => l.actor_role.toLowerCase().includes("automat") || l.actor.toLowerCase() === "system").length;
    return { total, todays, critical, automated };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv(
      "audit-logs.csv",
      filtered.map((l) => ({
        created_at: l.created_at,
        action: l.action,
        entity: l.entity,
        entity_ref: l.entity_ref,
        actor: l.actor,
        actor_role: l.actor_role,
        severity: l.severity,
        ip_address: l.ip_address,
      })),
    );
  };

  return (
    <SectionShell
      title="Audit Logs"
      description="Immutable, timestamped record of all financial actions"
      icon={ScrollText}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Legal Compliance Mode Active</p>
                <p className="text-sm text-muted-foreground">All logs are immutable, encrypted, and retained for 7 years</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="h-4 w-4" /> Tamper-proof
              </span>
              <Badge variant="outline" className="text-primary">GST/VAT Compliant</Badge>
            </div>
          </div>
        </div>

        <StatGrid>
          <StatCard label="Total Logs" value={stats.total} icon={ScrollText} loading={auditState.isLoading} />
          <StatCard label="Today's Actions" value={stats.todays} icon={ScrollText} loading={auditState.isLoading} />
          <StatCard label="Critical Severity" value={stats.critical} icon={Shield} tone="danger" loading={auditState.isLoading} />
          <StatCard label="Automated Actions" value={stats.automated} icon={User} loading={auditState.isLoading} />
        </StatGrid>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by action, actor, entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {severities.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PanelCard title="Audit Trail">
          <QueryState isLoading={auditState.isLoading} error={auditState.error} isEmpty={filtered.length === 0}>
            <div className="space-y-2">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border-l-4 border-l-transparent bg-muted/30 p-4 transition-colors hover:border-l-primary hover:bg-muted/50"
                >
                  <div className="min-w-[170px]">
                    <p className="font-mono text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
                    <p className="text-xs text-muted-foreground">{log.entity_ref ?? log.entity}</p>
                  </div>

                  <div className="min-w-[220px] flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={log.severity} />
                      <span className="font-mono text-sm font-semibold text-foreground">{log.action}</span>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{log.entity.replace(/_/g, " ")}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{log.actor}</span>
                      <Badge variant="outline" className="px-1 text-[10px]">{log.actor_role}</Badge>
                    </div>
                    <span className="font-mono">{log.ip_address}</span>
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
