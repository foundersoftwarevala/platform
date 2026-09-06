import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Network, Globe, ArrowDownRight, ArrowUpRight,
  Activity, AlertTriangle, Clock, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';

interface RegionTraffic {
  region: string;
  code: string;
  inbound: number;
  outbound: number;
  latency: number;
  packetLoss: number;
}

interface NetworkEvent {
  id: string;
  type: string;
  message: string;
  time: string;
  severity: string;
}

const formatRelative = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const SMNetwork = () => {
  const [loading, setLoading] = useState(true);
  const [trafficByRegion, setTrafficByRegion] = useState<RegionTraffic[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [activeConnections, setActiveConnections] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const [traffic, eventRows, servers] = await Promise.all([
        smQuery('network traffic', () =>
          supabase
            .from('server_network_traffic')
            .select('region_code, region_name, inbound_mbps, outbound_mbps, latency_ms, packet_loss, recorded_at')
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: false }),
        ),
        smQuery('network events', () =>
          supabase
            .from('server_network_events')
            .select('id, event_type, message, severity, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
        ),
        smQuery('running servers', () =>
          supabase
            .from('server_instances')
            .select('id')
            .eq('status', 'running'),
        ),
      ]);

      if (traffic === null || eventRows === null || servers === null) {
        setLoadError('Failed to load network data.');
        return;
      }
      setLoadError(null);

    const rows = traffic ?? [];
    const byRegion = new Map<string, RegionTraffic>();
    for (const r of rows) {
      if (!byRegion.has(r.region_code)) {
        byRegion.set(r.region_code, {
          region: r.region_name,
          code: r.region_code,
          inbound: Number(r.inbound_mbps || 0),
          outbound: Number(r.outbound_mbps || 0),
          latency: Number(r.latency_ms || 0),
          packetLoss: Number(r.packet_loss || 0),
        });
      }
    }
    setTrafficByRegion(Array.from(byRegion.values()));
    setActiveConnections((servers ?? []).length * 120);

    setEvents(
      (eventRows ?? []).map((e) => ({
        id: e.id,
        type: e.event_type,
        message: e.message,
        time: formatRelative(e.created_at),
        severity: e.severity,
      })),
    );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalInbound = Math.round(trafficByRegion.reduce((a, r) => a + r.inbound, 0));
  const totalOutbound = Math.round(trafficByRegion.reduce((a, r) => a + r.outbound, 0));
  const avgLatency = trafficByRegion.length
    ? Math.round(trafficByRegion.reduce((a, r) => a + r.latency, 0) / trafficByRegion.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Network & Traffic" subtitle="Monitor network performance and traffic patterns" />

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading network data...
        </div>
      ) : (
        <>
          {/* Network Overview */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownRight className="w-4 h-4 text-accent-emerald" />
                  <span className="text-muted-foreground text-sm">Inbound</span>
                </div>
                <p className="text-2xl font-bold text-accent-emerald">{totalInbound} Mb/s</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground text-sm">Outbound</span>
                </div>
                <p className="text-2xl font-bold text-primary">{totalOutbound} Mb/s</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-accent-pink" />
                  <span className="text-muted-foreground text-sm">Est. Connections</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{activeConnections.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Across running servers</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-accent-amber" />
                  <span className="text-muted-foreground text-sm">Avg Latency</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{avgLatency}ms</p>
              </CardContent>
            </Card>
          </div>

          {/* Traffic by Region */}
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Traffic by Region
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trafficByRegion.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No network traffic recorded in the last hour.</p>
                ) : (
                  trafficByRegion.map((region, i) => (
                    <motion.div
                      key={region.code}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="rounded-lg border border-border bg-surface/60 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            {region.code}
                          </Badge>
                          <span className="text-foreground font-medium">{region.region}</span>
                          {region.packetLoss > 1 && (
                            <Badge className="bg-accent-amber/10 text-accent-amber">
                              {region.packetLoss.toFixed(2)}% loss
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <ArrowDownRight className="w-4 h-4 text-accent-emerald" />
                            <span className="text-accent-emerald font-mono">{Math.round(region.inbound)} Mb/s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-primary" />
                            <span className="text-primary font-mono">{Math.round(region.outbound)} Mb/s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground font-mono">{Math.round(region.latency)}ms</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Inbound Load</span>
                            <span className="text-accent-emerald">{Math.min(100, Math.round((region.inbound / 500) * 100))}%</span>
                          </div>
                          <Progress value={Math.min(100, (region.inbound / 500) * 100)} className="h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Outbound Load</span>
                            <span className="text-primary">{Math.min(100, Math.round((region.outbound / 400) * 100))}%</span>
                          </div>
                          <Progress value={Math.min(100, (region.outbound / 400) * 100)} className="h-1.5" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Network Events */}
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                Recent Network Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No recent network events.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface/60 p-3">
                      <div className="flex items-center gap-3">
                        {event.severity === 'warning' || event.severity === 'critical' ? (
                          <AlertTriangle className={`w-4 h-4 ${event.severity === 'critical' ? 'text-destructive' : 'text-accent-amber'}`} />
                        ) : (
                          <Activity className="w-4 h-4 text-primary" />
                        )}
                        <span className="text-foreground">{event.message}</span>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">{event.time}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SMNetwork;
