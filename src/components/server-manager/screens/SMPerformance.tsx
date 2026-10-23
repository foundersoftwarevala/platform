import { useState, useEffect, useCallback } from 'react';
import { useTranslation as useI18nSource } from "@/lib/i18n/use-translation";
import {
  Target, BarChart3, Loader2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';
import { useServerTelemetry } from '@/hooks/useServerTelemetry';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { TelemetryTrend } from '../layout/TelemetryTrend';

interface ServerPerf {
  id: string;
  server: string;
}

const SMPerformance = () => {
    const { t: translateText } = useI18nSource();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [perfData, setPerfData] = useState<ServerPerf[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rangeMs = timeRange === '1h' ? 60 * 60_000
    : timeRange === '6h' ? 6 * 60 * 60_000
      : timeRange === '7d' ? 7 * 24 * 60 * 60_000
        : 24 * 60 * 60_000;
  const telemetry = useServerTelemetry(rangeMs);
  const metricsByServer = new Map(telemetry.servers.map((server) => [server.id, server]));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const servers = await smQuery('server performance inventory', () =>
        supabase
          .from('server_instances')
          .select('id, server_name')
          .neq('status', 'decommissioned')
          .order('server_name', { ascending: true }),
      );

      if (servers === null) {
        setLoadError('Failed to load performance data.');
        return;
      }
      setLoadError(null);

      setPerfData(servers.map((server) => ({ id: server.id, server: server.server_name })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            {translateText("server_manager.retry_9f5cd8")}</Button>
        </div>
      )}

      <PageHeader
        title={translateText("server_manager.performance_tracking_1df713")}
        subtitle="Performance trends use fresh agent telemetry; SLA compliance remains unverified"
        action={
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" /> Loading performance data...
        </div>
      ) : (
        <>
          {/* Trend Comparison */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bento-card">
              <p className="mb-2 text-sm text-muted-foreground">CPU · {timeRange}</p>
              <TelemetryTrend
                samples={telemetry.servers.filter((server) => server.health === 'live').flatMap((server) => server.history)}
                metric="cpu_usage"
                label="CPU"
              />
            </div>
            <div className="bento-card">
              <p className="mb-2 text-sm text-muted-foreground">RAM · {timeRange}</p>
              <TelemetryTrend
                samples={telemetry.servers.filter((server) => server.health === 'live').flatMap((server) => server.history)}
                metric="ram_usage"
                label="RAM"
              />
            </div>
          </div>

          {/* Overall SLA */}
          <div className="bento-card enter-soft">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Target className="w-5 h-5 text-primary" />
              Overall SLA Compliance
            </div>
            <div className="flex items-center gap-8">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" className="text-border" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Target SLA</span>
                  <span className="font-medium text-muted-foreground">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current SLA</span>
                  <span className="text-muted-foreground">Unverified · uptime telemetry is not an SLA measurement</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Response Time</span>
                  <span className="font-medium text-muted-foreground">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. Downtime ({timeRange})</span>
                  <span className="font-medium text-muted-foreground">—</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Server Performance */}
          <div className="bento-card enter-soft">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <BarChart3 className="w-5 h-5 text-primary" />
              Server Performance Breakdown
            </div>
            <div className="space-y-4">
              {perfData.length === 0 ? (
                <p className="text-muted-foreground text-sm">{loadError ? 'Server inventory is unavailable.' : 'No servers found.'}</p>
              ) : (
                perfData.map((server) => (
                  <div
                    key={server.id}
                    className="p-4 rounded-xl bg-surface/60 border border-border"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <ServerHealthBadge lastSeen={metricsByServer.get(server.id)?.lastSeen} />
                        <div>
                          <p className="font-medium">{server.server}</p>
                          <p className="text-muted-foreground text-sm">
                            {metricsByServer.get(server.id)?.health === 'live' && metricsByServer.get(server.id)?.latest
                              ? `Source: Agent · ${new Date(metricsByServer.get(server.id)!.latest!.recorded_at).toLocaleString()}`
                              : 'Waiting for fresh agent data'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-muted-foreground font-medium">
                            {metricsByServer.get(server.id)?.health === 'live' && metricsByServer.get(server.id)?.latest
                              ? `${metricsByServer.get(server.id)!.latest!.cpu_usage.toFixed(1)}%`
                              : '—'}
                          </p>
                          <p className="text-muted-foreground text-xs">CPU</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground font-medium">
                            {metricsByServer.get(server.id)?.health === 'live' && metricsByServer.get(server.id)?.latest
                              ? `${metricsByServer.get(server.id)!.latest!.ram_usage.toFixed(1)}%`
                              : '—'}
                          </p>
                          <p className="text-muted-foreground text-xs">RAM</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground font-medium">
                            {metricsByServer.get(server.id)?.health === 'live' && metricsByServer.get(server.id)?.latest
                              ? `${metricsByServer.get(server.id)!.latest!.disk_usage.toFixed(1)}%`
                              : '—'}
                          </p>
                          <p className="text-muted-foreground text-xs">Disk</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SMPerformance;
