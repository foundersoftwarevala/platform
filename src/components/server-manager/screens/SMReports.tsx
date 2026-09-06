import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, TrendingUp, CheckCircle, Lock, Sparkles, Server, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { PageHeader, EmptyState } from '../layout/PageShell';

const REPORT_TYPES = [
  { value: 'health', label: 'Infrastructure Health' },
  { value: 'incidents', label: 'Incident MTTR' },
  { value: 'cost', label: 'Cost & Capacity' },
];

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface HealthReport {
  overallHealth: number;
  avgResponseTime: number;
  avgErrorRate: number;
  serverCount: number;
  slaRows: { service: string; target: number; actual: number; compliant: boolean }[];
}

interface IncidentReport {
  totalIncidents: number;
  resolved: number;
  avgMttr: number;
  bySeverity: Record<string, number>;
}

interface CostReport {
  totalMonthlyCost: number;
  avgCostPerServer: number;
  totalCapacityGb: number;
  usedDiskPercent: number;
  topServers: { name: string; cost: number }[];
}

const SMReports = () => {
  const [reportType, setReportType] = useState('health');
  const [range, setRange] = useState('30d');
  const [generating, setGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [incidentReport, setIncidentReport] = useState<IncidentReport | null>(null);
  const [costReport, setCostReport] = useState<CostReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    setLoadError(null);
    const days = RANGE_DAYS[range] ?? 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    try {
    if (reportType === 'health') {
      const servers = await smQuery('infrastructure health data', () =>
        supabase
          .from('server_instances')
          .select('health_score, response_time_ms, error_rate, uptime_percent, sla_percent, server_name')
          .neq('status', 'decommissioned'),
      );
      if (servers === null) {
        setLoadError('Could not generate the health report. Please retry.');
        return;
      }
      const rows = servers ?? [];
      const avg = (fn: (r: (typeof rows)[number]) => number) =>
        rows.length ? rows.reduce((a, r) => a + Number(fn(r) || 0), 0) / rows.length : 0;
      setHealthReport({
        overallHealth: avg((r) => r.health_score),
        avgResponseTime: avg((r) => r.response_time_ms),
        avgErrorRate: avg((r) => r.error_rate),
        serverCount: rows.length,
        slaRows: rows.slice(0, 6).map((r) => ({
          service: r.server_name,
          target: Number(r.sla_percent || 99.9),
          actual: Number(r.uptime_percent || 0),
          compliant: Number(r.uptime_percent || 0) >= Number(r.sla_percent || 99.9),
        })),
      });
    } else if (reportType === 'incidents') {
      const incidents = await smQuery('incident data', () =>
        supabase
          .from('server_incidents')
          .select('status, severity, mttr_minutes, opened_at')
          .gte('opened_at', since),
      );
      if (incidents === null) {
        setLoadError('Could not generate the incident report. Please retry.');
        return;
      }
      const rows = incidents ?? [];
      const resolved = rows.filter((r) => r.status === 'resolved').length;
      const mttrVals = rows.filter((r) => r.mttr_minutes != null).map((r) => Number(r.mttr_minutes));
      const bySeverity = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      }, {});
      setIncidentReport({
        totalIncidents: rows.length,
        resolved,
        avgMttr: mttrVals.length ? Math.round(mttrVals.reduce((a, b) => a + b, 0) / mttrVals.length) : 0,
        bySeverity,
      });
    } else {
      const servers = await smQuery('cost & capacity data', () =>
        supabase
          .from('server_instances')
          .select('server_name, monthly_cost, storage_gb, disk_usage')
          .neq('status', 'decommissioned'),
      );
      if (servers === null) {
        setLoadError('Could not generate the cost report. Please retry.');
        return;
      }
      const rows = servers ?? [];
      const totalCost = rows.reduce((a, r) => a + Number(r.monthly_cost || 0), 0);
      const totalCapacity = rows.reduce((a, r) => a + Number(r.storage_gb || 0), 0);
      const avgDiskUsage = rows.length ? rows.reduce((a, r) => a + Number(r.disk_usage || 0), 0) / rows.length : 0;
      setCostReport({
        totalMonthlyCost: totalCost,
        avgCostPerServer: rows.length ? totalCost / rows.length : 0,
        totalCapacityGb: totalCapacity,
        usedDiskPercent: avgDiskUsage,
        topServers: [...rows]
          .sort((a, b) => Number(b.monthly_cost || 0) - Number(a.monthly_cost || 0))
          .slice(0, 5)
          .map((r) => ({ name: r.server_name, cost: Number(r.monthly_cost || 0) })),
      });
    }

    setGeneratedAt(new Date().toLocaleString());
    } finally {
      setGenerating(false);
    }
  }, [reportType, range]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate live reports from real infrastructure data"
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>No export · No copy</span>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void generateReport()}>
            Retry
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className="bento-card enter-soft p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Report Type</span>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Date Range</span>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void generateReport()} disabled={generating} className="ml-auto">
          <Sparkles className="w-4 h-4 mr-2" />
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </div>

      {generatedAt && (
        <p className="text-xs text-muted-foreground">Report generated at {generatedAt} from live data.</p>
      )}

      {/* Health Report */}
      {reportType === 'health' && healthReport && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="bento-card !p-0">
            <CardHeader><CardTitle className="text-sm font-semibold tracking-tight">Daily Infrastructure Health</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Overall Health</p>
                  <p className="text-xl font-bold">{healthReport.overallHealth.toFixed(1)}%</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg Response Time</p>
                  <p className="text-xl font-bold">{Math.round(healthReport.avgResponseTime)}ms</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Error Rate</p>
                  <p className="text-xl font-bold">{healthReport.avgErrorRate.toFixed(2)}%</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Servers Analyzed</p>
                  <p className="text-xl font-bold">{healthReport.serverCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card !p-0 overflow-hidden">
            <CardHeader><CardTitle className="text-sm font-semibold tracking-tight">SLA Compliance Report</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">Server</th>
                    <th className="text-left px-6 py-3 font-medium">Target SLA</th>
                    <th className="text-left px-6 py-3 font-medium">Actual</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {healthReport.slaRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-6 text-center text-muted-foreground">No servers found.</td></tr>
                  ) : healthReport.slaRows.map((item) => (
                    <tr key={item.service} className="border-b border-border/60 hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{item.service}</td>
                      <td className="px-6 py-4 text-muted-foreground">{item.target.toFixed(2)}%</td>
                      <td className="px-6 py-4">
                        <span className={item.compliant ? 'text-accent-emerald font-semibold' : 'text-destructive font-semibold'}>
                          {item.actual.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.compliant ? (
                          <span className="inline-flex items-center gap-1 text-accent-emerald text-sm">
                            <CheckCircle className="w-4 h-4" /> Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive text-sm">
                            <AlertTriangle className="w-4 h-4" /> Breach
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Incident Report */}
      {reportType === 'incidents' && incidentReport && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bento-card !p-0">
            <CardHeader><CardTitle className="text-sm font-semibold tracking-tight">Incident MTTR (Mean Time to Resolve)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Total Incidents</p>
                  <p className="text-xl font-bold">{incidentReport.totalIncidents}</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Avg MTTR</p>
                  <p className="text-xl font-bold">{incidentReport.avgMttr} min</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Resolved</p>
                  <p className="text-xl font-bold text-accent-emerald">{incidentReport.resolved}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-2">By Severity</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(incidentReport.bySeverity).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No incidents in this period.</p>
                ) : Object.entries(incidentReport.bySeverity).map(([sev, count]) => (
                  <Badge key={sev} className="bg-surface text-muted-foreground border-border">{sev}: {count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cost Report */}
      {reportType === 'cost' && costReport && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="bento-card !p-0">
            <CardHeader><CardTitle className="text-sm font-semibold tracking-tight">Cost & Capacity Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total Monthly Cost</p>
                  <p className="text-xl font-bold">₹{Math.round(costReport.totalMonthlyCost).toLocaleString()}</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg Cost / Server</p>
                  <p className="text-xl font-bold">₹{Math.round(costReport.avgCostPerServer).toLocaleString()}</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total Capacity</p>
                  <p className="text-xl font-bold">{Math.round(costReport.totalCapacityGb)} GB</p>
                </div>
                <div className="bento-card !p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg Disk Usage</p>
                  <p className="text-xl font-bold">{costReport.usedDiskPercent.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card !p-0">
            <CardHeader><CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2"><Server className="w-5 h-5 text-primary" />Top Servers by Cost</CardTitle></CardHeader>
            <CardContent>
              {costReport.topServers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No servers found.</p>
              ) : (
                <div className="space-y-2">
                  {costReport.topServers.map((s) => (
                    <div key={s.name} className="flex justify-between items-center p-3 rounded-xl bg-surface/60 border border-border">
                      <span className="text-foreground">{s.name}</span>
                      <span className="text-primary font-semibold">₹{s.cost.toLocaleString()}/mo</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!healthReport && !incidentReport && !costReport && (
        <EmptyState
          icon={FileText}
          title="No report generated yet"
          description='Select a report type and click "Generate Report" to pull live data.'
        />
      )}

      <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-3">
        <p className="text-xs text-accent-amber">
          Export disabled · Copy disabled — Reports are view-only
        </p>
      </div>
    </div>
  );
};

export default SMReports;
