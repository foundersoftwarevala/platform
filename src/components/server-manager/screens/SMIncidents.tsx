import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface Incident {
  id: string;
  incident_code: string;
  incident_type: string;
  severity: string;
  status: string;
  summary: string;
  opened_at: string;
  resolved_at: string | null;
  server_id: string | null;
  server_name: string;
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

const SMIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smQuery('incidents', () =>
        supabase
          .from('server_incidents')
          .select('id, incident_code, incident_type, severity, status, summary, opened_at, resolved_at, server_id, server_instances(server_name)')
          .order('opened_at', { ascending: false }),
      );

      if (data === null) {
        setLoadError('Failed to load incidents.');
        setIncidents([]);
        return;
      }
      setLoadError(null);

      setIncidents(
        (data ?? []).map((i) => ({
          id: i.id,
          incident_code: i.incident_code,
          incident_type: i.incident_type,
          severity: i.severity,
          status: i.status,
          summary: i.summary,
          opened_at: i.opened_at,
          resolved_at: i.resolved_at,
          server_id: i.server_id,
          server_name:
            (i as unknown as { server_instances?: { server_name?: string } }).server_instances
              ?.server_name ?? 'Infrastructure',
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = {
    critical: loading || loadError ? null : incidents.filter((i) => i.severity === 'critical').length,
    warning: loading || loadError ? null : incidents.filter((i) => i.severity === 'warning').length,
    info: loading || loadError ? null : incidents.filter((i) => i.severity === 'info').length,
    resolvedToday: incidents.filter(
      (i) => i.status === 'resolved' && i.resolved_at && new Date(i.resolved_at).toDateString() === new Date().toDateString(),
    ).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts & Incidents" subtitle="Recorded incidents. Alert delivery and response actions are unavailable until their integrations are connected." />

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Critical</p>
            <p className="text-2xl font-bold text-destructive">{counts.critical ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-accent-amber">Warning</p>
            <p className="text-2xl font-bold text-accent-amber">{counts.warning ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-primary">Info</p>
            <p className="text-2xl font-bold text-primary">{counts.info ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-accent-emerald">Resolved Today</p>
            <p className="text-2xl font-bold text-accent-emerald">{loading || loadError ? '—' : counts.resolvedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card className="bento-card overflow-hidden !p-0">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Incident ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Severity</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Affected</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading incidents...
                </td>
              </tr>
            )}
            {!loading && loadError && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  Incident data is unavailable.
                </td>
              </tr>
            )}
            {!loading && !loadError && incidents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No incidents recorded.
                </td>
              </tr>
            )}
            {!loading &&
              incidents.map((incident, idx) => (
                <tr
                  key={incident.id}
                  className={`border-b border-border/60 hover:bg-surface/60 transition-colors ${idx === incidents.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{incident.incident_code}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(incident.opened_at)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-foreground">{incident.incident_type}</td>
                  <td className="px-6 py-4">
                    <Badge className={
                       incident.severity === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                       incident.severity === 'warning' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' :
                       'bg-primary/10 text-primary border-primary/30'
                    }>
                      {incident.severity}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{incident.server_name}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={
                       incident.status === 'resolved' ? 'border-accent-emerald/40 text-accent-emerald' :
                       incident.status === 'in_progress' ? 'border-primary/40 text-primary' :
                       'border-border text-muted-foreground'
                    }>
                      {incident.status.replace('_', ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Incident records are read-only here; notification delivery and audited response workflows are not connected.
      </p>
    </div>
  );
};

export default SMIncidents;
