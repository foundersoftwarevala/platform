import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, HardDrive, Server, AlertTriangle, CheckCircle2, BarChart3, Loader2, Network,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';

interface ServerResource {
  id: string;
  server: string;
  cpu: { used: number; total: number; percent: number };
  ram: { used: number; total: number; percent: number };
  disk: { used: number; total: number; percent: number };
  bandwidth: { used: number; total: number; percent: number };
}

const SMResources = () => {
  const [loading, setLoading] = useState(true);
  const [resourceData, setResourceData] = useState<ServerResource[]>([]);
  const [trend, setTrend] = useState<{ cpu: number[]; ram: number[] }>({ cpu: [], ram: [] });
  const [loadError, setLoadError] = useState<string | null>(null);

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-destructive';
    if (percent >= 70) return 'text-accent-amber';
    return 'text-accent-emerald';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 70) return 'bg-accent-amber';
    return 'bg-accent-emerald';
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
      const [servers, history] = await Promise.all([
        smQuery('server resource usage', () =>
          supabase
            .from('server_instances')
            .select('id, server_name, cpu_cores, cpu_usage, ram_gb, ram_usage, storage_gb, disk_usage, network_in_mbps, network_out_mbps')
            .neq('status', 'decommissioned')
            .order('server_name', { ascending: true }),
        ),
        smQuery('resource history', () =>
          supabase
            .from('server_metrics_history')
            .select('cpu_usage, ram_usage, recorded_at')
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: true }),
        ),
      ]);

      if (servers === null || history === null) {
        setLoadError('Failed to load resource data.');
        return;
      }
      setLoadError(null);

    const rows = servers ?? [];
    setResourceData(
      rows.map((s) => {
        const cpuUsed = (Number(s.cpu_usage || 0) / 100) * Number(s.cpu_cores || 0);
        const ramUsed = (Number(s.ram_usage || 0) / 100) * Number(s.ram_gb || 0);
        const diskUsed = (Number(s.disk_usage || 0) / 100) * Number(s.storage_gb || 0);
        const bandwidthUsed = Number(s.network_in_mbps || 0) + Number(s.network_out_mbps || 0);
        const bandwidthTotal = 1000;
        return {
          id: s.id,
          server: s.server_name,
          cpu: { used: Math.round(cpuUsed * 10) / 10, total: Number(s.cpu_cores || 0), percent: Math.round(Number(s.cpu_usage || 0)) },
          ram: { used: Math.round(ramUsed * 10) / 10, total: Number(s.ram_gb || 0), percent: Math.round(Number(s.ram_usage || 0)) },
          disk: { used: Math.round(diskUsed), total: Number(s.storage_gb || 0), percent: Math.round(Number(s.disk_usage || 0)) },
          bandwidth: { used: Math.round(bandwidthUsed), total: bandwidthTotal, percent: Math.min(100, Math.round((bandwidthUsed / bandwidthTotal) * 100)) },
        };
      }),
    );

    const pts = history ?? [];
    const bucketCount = 20;
    const bucketed = (key: 'cpu_usage' | 'ram_usage') => {
      if (!pts.length) return [] as number[];
      const size = Math.ceil(pts.length / bucketCount);
      const out: number[] = [];
      for (let i = 0; i < pts.length; i += size) {
        const slice = pts.slice(i, i + size);
        out.push(Math.round(slice.reduce((a, p) => a + Number(p[key] || 0), 0) / slice.length));
      }
      return out.slice(-bucketCount);
    };
    setTrend({ cpu: bucketed('cpu_usage'), ram: bucketed('ram_usage') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = {
    cpu: {
      used: resourceData.reduce((a, b) => a + b.cpu.used, 0),
      total: resourceData.reduce((a, b) => a + b.cpu.total, 0),
    },
    ram: {
      used: resourceData.reduce((a, b) => a + b.ram.used, 0),
      total: resourceData.reduce((a, b) => a + b.ram.total, 0),
    },
    disk: {
      used: resourceData.reduce((a, b) => a + b.disk.used, 0),
      total: resourceData.reduce((a, b) => a + b.disk.total, 0),
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Resource Usage" subtitle="Monitor CPU, memory, and storage across all servers" />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" /> Loading resource data...
        </div>
      ) : (
        <>
          {/* Total Resources */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3 mb-3">
                <Cpu className="w-5 h-5 text-primary" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total CPU</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="mt-1 text-xl font-bold">{totals.cpu.used.toFixed(1)}</p>
                <span className="text-muted-foreground">/ {totals.cpu.total} cores</span>
              </div>
              <Progress value={totals.cpu.total ? (totals.cpu.used / totals.cpu.total) * 100 : 0} className="h-2" />
            </div>

            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3 mb-3">
                <HardDrive className="w-5 h-5 text-accent-pink" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total RAM</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="mt-1 text-xl font-bold">{totals.ram.used.toFixed(1)}</p>
                <span className="text-muted-foreground">/ {totals.ram.total} GB</span>
              </div>
              <Progress value={totals.ram.total ? (totals.ram.used / totals.ram.total) * 100 : 0} className="h-2" />
            </div>

            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3 mb-3">
                <HardDrive className="w-5 h-5 text-accent-amber" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Storage</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="mt-1 text-xl font-bold">{totals.disk.used}</p>
                <span className="text-muted-foreground">/ {totals.disk.total} GB</span>
              </div>
              <Progress value={totals.disk.total ? (totals.disk.used / totals.disk.total) * 100 : 0} className="h-2" />
            </div>
          </div>

          {/* History Trend */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bento-card enter-soft">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Cpu className="w-5 h-5 text-primary" /> CPU Trend (6h)
              </div>
              {trend.cpu.length === 0 ? (
                <p className="text-muted-foreground text-sm">No history recorded yet.</p>
              ) : (
                <div className="h-32 flex items-end gap-1">
                  {trend.cpu.map((v, i) => (
                    <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${v}%` }} transition={{ duration: 0.4, delay: i * 0.02 }} className="flex-1 bg-gradient-to-t from-primary/50 to-primary-glow/30 rounded-t" />
                  ))}
                </div>
              )}
            </div>
            <div className="bento-card enter-soft">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <HardDrive className="w-5 h-5 text-accent-pink" /> RAM Trend (6h)
              </div>
              {trend.ram.length === 0 ? (
                <p className="text-muted-foreground text-sm">No history recorded yet.</p>
              ) : (
                <div className="h-32 flex items-end gap-1">
                  {trend.ram.map((v, i) => (
                    <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${v}%` }} transition={{ duration: 0.4, delay: i * 0.02 }} className="flex-1 bg-gradient-to-t from-accent-pink/50 to-accent-pink/30 rounded-t" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Per-Server Resources */}
          <div className="bento-card enter-soft">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <BarChart3 className="w-5 h-5 text-primary" />
              Resource Allocation by Server
            </div>
            <div className="space-y-6">
              {resourceData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No servers found.</p>
              ) : (
                resourceData.map((server, i) => (
                  <motion.div
                    key={server.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-xl bg-surface/60 border border-border"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Server className="w-5 h-5 text-primary" />
                      <h3 className="font-medium">{server.server}</h3>
                      {server.cpu.percent >= 80 || server.ram.percent >= 80 ? (
                        <AlertTriangle className="w-4 h-4 text-accent-amber" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">CPU</span>
                          <span className={`text-sm font-medium ${getUsageColor(server.cpu.percent)}`}>{server.cpu.percent}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(server.cpu.percent)} rounded-full transition-all`} style={{ width: `${server.cpu.percent}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.cpu.used} / {server.cpu.total} cores</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">RAM</span>
                          <span className={`text-sm font-medium ${getUsageColor(server.ram.percent)}`}>{server.ram.percent}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(server.ram.percent)} rounded-full transition-all`} style={{ width: `${server.ram.percent}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.ram.used} / {server.ram.total} GB</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">Disk</span>
                          <span className={`text-sm font-medium ${getUsageColor(server.disk.percent)}`}>{server.disk.percent}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(server.disk.percent)} rounded-full transition-all`} style={{ width: `${server.disk.percent}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.disk.used} / {server.disk.total} GB</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm flex items-center gap-1"><Network className="w-3 h-3" />Bandwidth</span>
                          <span className={`text-sm font-medium ${getUsageColor(server.bandwidth.percent)}`}>{server.bandwidth.percent}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(server.bandwidth.percent)} rounded-full transition-all`} style={{ width: `${server.bandwidth.percent}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.bandwidth.used} / {server.bandwidth.total} Mb/s</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SMResources;
