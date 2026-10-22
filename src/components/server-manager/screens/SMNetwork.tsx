import { useState, useEffect, useCallback } from 'react';
import {
  Network, Globe, ArrowDownRight, ArrowUpRight,
  Activity, AlertTriangle, Clock, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { useServerTelemetry } from '@/hooks/useServerTelemetry';

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
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const telemetry = useServerTelemetry(60 * 60 * 1000);
  const allServersLive = telemetry.servers.length > 0 &&
    telemetry.servers.every((server) => server.health === 'live' && server.latest !== null);
  const inbound = allServersLive
    ? telemetry.servers.reduce((sum, server) => sum + server.latest!.network_in_mbps, 0)
    : null;
  const outbound = allServersLive
    ? telemetry.servers.reduce((sum, server) => sum + server.latest!.network_out_mbps, 0)
    : null;
  const lastUpdated = allServersLive
    ? telemetry.servers
      .map((server) => server.latest!.recorded_at)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const eventRows = await smQuery('network events', () =>
          supabase
            .from('server_network_events')
            .select('id, event_type, message, severity, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
      );

      if (eventRows === null) {
        setLoadError('Failed to load network data.');
        return;
      }
      setLoadError(null);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network & Traffic"
        subtitle="Live traffic is shown only when every registered server has fresh agent data"
        action={<ServerHealthBadge lastSeen={allServersLive
          ? telemetry.servers.map((server) => server.lastSeen!).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
          : null} />}
      />

      {telemetry.error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Agent network telemetry is unavailable.
        </div>
      )}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">Source: Agent · Last updated: {new Date(lastUpdated).toLocaleString()}</p>
      )}

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
                <p className="text-2xl font-bold text-muted-foreground">{inbound === null ? '—' : `${inbound.toFixed(2)} Mbps`}</p>
                <p className="text-xs text-muted-foreground">{inbound === null ? 'Waiting for fresh agent data' : 'Source: Agent'}</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground text-sm">Outbound</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">{outbound === null ? '—' : `${outbound.toFixed(2)} Mbps`}</p>
                <p className="text-xs text-muted-foreground">{outbound === null ? 'Waiting for fresh agent data' : 'Source: Agent'}</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-accent-pink" />
                  <span className="text-muted-foreground text-sm">Active Connections</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Waiting for agent data</p>
              </CardContent>
            </Card>

            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-accent-amber" />
                  <span className="text-muted-foreground text-sm">Avg Latency</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Waiting for agent data</p>
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
                <p className="text-muted-foreground text-sm">Waiting for agent data.</p>
              </div>
            </CardContent>
          </Card>

          {/* Network Events */}
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                Existing Network Event Records
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
