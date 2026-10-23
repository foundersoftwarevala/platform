import { useState, useEffect, useCallback } from 'react';
import { useTranslation as useI18nSource } from "@/lib/i18n/use-translation";
import { motion } from 'framer-motion';
import {
  Cpu, HardDrive, Server, BarChart3, Loader2, Network,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { useServerTelemetry } from '@/hooks/useServerTelemetry';
import { TelemetryTrend } from '../layout/TelemetryTrend';

interface ServerResource {
  id: string;
  server: string;
  cpu: { total: number | null };
  ram: { total: number | null };
  disk: { total: number | null };
}

const SMResources = () => {
    const { t: translateText } = useI18nSource();
  const [loading, setLoading] = useState(true);
  const [resourceData, setResourceData] = useState<ServerResource[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const telemetry = useServerTelemetry();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const servers = await smQuery('server resource allocation', () =>
          supabase
            .from('server_instances')
            .select('id, server_name, cpu_cores, ram_gb, storage_gb')
            .neq('status', 'decommissioned')
            .order('server_name', { ascending: true }),
      );

      if (servers === null) {
        setLoadError('Failed to load resource data.');
        return;
      }
      setLoadError(null);

      setResourceData(
        servers.map((server) => ({
          id: server.id,
          server: server.server_name,
          cpu: { total: typeof server.cpu_cores === 'number' ? server.cpu_cores : null },
          ram: { total: typeof server.ram_gb === 'number' ? server.ram_gb : null },
          disk: { total: typeof server.storage_gb === 'number' ? server.storage_gb : null },
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalCapacity = (getCapacity: (server: ServerResource) => number | null) => {
    const values = resourceData.map(getCapacity);
    return values.length > 0 && values.every((value): value is number => value !== null)
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const totals = {
    cpu: totalCapacity((server) => server.cpu.total),
    ram: totalCapacity((server) => server.ram.total),
    disk: totalCapacity((server) => server.disk.total),
  };
  const telemetryByServer = new Map(telemetry.servers.map((server) => [server.id, server]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={translateText("server_manager.resource_usage_eb5ad7")}
        subtitle="Profiled capacity; live CPU, memory, and storage usage await agent data"
        action={<ServerHealthBadge lastSeen={null} />}
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            {translateText("server_manager.retry_9f5cd8")}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" /> {translateText("server_manager.loading_resource_data_812bd1")}</div>
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
                <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
                <span className="text-muted-foreground">/ {totals.cpu ?? '—'} provisioned cores</span>
              </div>
              <p className="text-xs text-muted-foreground">Waiting for agent data</p>
            </div>

            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3 mb-3">
                <HardDrive className="w-5 h-5 text-accent-pink" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total RAM</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
                <span className="text-muted-foreground">/ {totals.ram ?? '—'} GB provisioned</span>
              </div>
              <p className="text-xs text-muted-foreground">Waiting for agent data</p>
            </div>

            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3 mb-3">
                <HardDrive className="w-5 h-5 text-accent-amber" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Storage</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
                <span className="text-muted-foreground">/ {totals.disk ?? '—'} GB provisioned</span>
              </div>
              <p className="text-xs text-muted-foreground">Waiting for agent data</p>
            </div>
          </div>

          {/* History Trend */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bento-card enter-soft">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Cpu className="w-5 h-5 text-primary" /> CPU Trend (6h)
              </div>
              <TelemetryTrend
                samples={telemetry.servers.filter((server) => server.health === 'live').flatMap((server) => server.history)}
                metric="cpu_usage"
                label="CPU"
              />
            </div>
            <div className="bento-card enter-soft">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <HardDrive className="w-5 h-5 text-accent-pink" /> RAM Trend (6h)
              </div>
              <TelemetryTrend
                samples={telemetry.servers.filter((server) => server.health === 'live').flatMap((server) => server.history)}
                metric="ram_usage"
                label="RAM"
              />
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
                      <ServerHealthBadge lastSeen={telemetryByServer.get(server.id)?.lastSeen} />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">CPU</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {telemetryByServer.get(server.id)?.health === 'live' && telemetryByServer.get(server.id)?.latest
                              ? `${telemetryByServer.get(server.id)!.latest!.cpu_usage.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.cpu.total ?? '—'} provisioned cores</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">RAM</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {telemetryByServer.get(server.id)?.health === 'live' && telemetryByServer.get(server.id)?.latest
                              ? `${telemetryByServer.get(server.id)!.latest!.ram_usage.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.ram.total ?? '—'} GB provisioned</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm">Disk</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {telemetryByServer.get(server.id)?.health === 'live' && telemetryByServer.get(server.id)?.latest
                              ? `${telemetryByServer.get(server.id)!.latest!.disk_usage.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{server.disk.total ?? '—'} GB provisioned</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-sm flex items-center gap-1"><Network className="w-3 h-3" />Bandwidth</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {telemetryByServer.get(server.id)?.health === 'live' && telemetryByServer.get(server.id)?.latest
                              ? `${telemetryByServer.get(server.id)!.latest!.network_in_mbps.toFixed(2)} / ${telemetryByServer.get(server.id)!.latest!.network_out_mbps.toFixed(2)} Mbps`
                              : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Waiting for agent data</p>
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
