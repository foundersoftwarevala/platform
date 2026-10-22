import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { smQuery } from '@/lib/sm-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '../layout/PageShell';

interface FirewallRule {
  id: string;
  rule_name: string;
  status: string;
  ports: string;
  action: string;
  direction: string;
  source_cidr: string;
}

interface SecurityAlert {
  id: string;
  alert_code: string | null;
  alert_type: string;
  source_ip: string | null;
  severity: string;
  time: string;
  status: string;
}

interface PatchServer {
  id: string;
  server: string;
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

const SMSecurity = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<FirewallRule[] | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[] | null>(null);
  const [patchStatus, setPatchStatus] = useState<PatchServer[] | null>(null);
  const [intrusionCount, setIntrusionCount] = useState<number | null>(null);
  const [portScanCount, setPortScanCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [firewallRules, securityAlerts, servers] = await Promise.all([
        smQuery('firewall rules', () =>
          supabase.from('server_firewall_rules').select('*').order('created_at', { ascending: false }),
        ),
        smQuery('security alerts', () =>
          supabase
            .from('server_alerts')
            .select('id, alert_code, alert_type, source_ip, severity, status, created_at, category')
            .eq('category', 'security')
            .order('created_at', { ascending: false })
            .limit(10),
        ),
        smQuery('patch status', () =>
          supabase
            .from('server_instances')
            .select('id, server_name')
            .neq('status', 'decommissioned'),
        ),
      ]);

      if (firewallRules === null || securityAlerts === null || servers === null) {
        setLoadError('Failed to load security data.');
        setRules(null);
        setAlerts(null);
        setPatchStatus(null);
        setIntrusionCount(null);
        setPortScanCount(null);
        return;
      }
      setLoadError(null);

    setRules(
      firewallRules.map((r) => ({
        id: r.id,
        rule_name: r.rule_name,
        status: r.status,
        ports: r.ports,
        action: r.action,
        direction: r.direction,
        source_cidr: r.source_cidr,
      })),
    );

    setAlerts(
      securityAlerts.map((a) => ({
        id: a.id,
        alert_code: a.alert_code,
        alert_type: a.alert_type,
        source_ip: a.source_ip,
        severity: a.severity,
        status: a.status,
        time: formatRelative(a.created_at),
      })),
    );
    setPortScanCount(securityAlerts.filter((a) => a.alert_type?.toLowerCase().includes('scan')).length);
    setIntrusionCount(securityAlerts.filter((a) => a.alert_type?.toLowerCase().includes('intrusion')).length);

    setPatchStatus(
      servers.map((s) => ({
        id: s.id,
        server: s.server_name,
      })),
    );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader title="Security & Firewall" subtitle="Firewall rules, security alerts, and patch compliance" />

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
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading security data...
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <Shield className="w-5 h-5 text-accent-emerald mb-2" />
                <p className="text-sm text-muted-foreground">Stored Firewall Rule Definitions</p>
                <p className="text-lg font-bold text-muted-foreground">{rules?.length ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Not applied to servers</p>
              </CardContent>
            </Card>
            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <AlertTriangle className="w-5 h-5 text-accent-amber mb-2" />
                <p className="text-sm text-muted-foreground">Recorded Port Scan Alerts</p>
                <p className="text-lg font-bold text-accent-amber">{portScanCount ?? '—'}</p>
              </CardContent>
            </Card>
            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">Recorded Intrusion Flags</p>
                <p className="text-lg font-bold text-destructive">{intrusionCount ?? '—'}</p>
              </CardContent>
            </Card>
            <Card className="bento-card premium-halo hover-lift !p-0">
              <CardContent className="p-4">
                <CheckCircle className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Agent Patch Findings</p>
                <p className="text-lg font-bold text-muted-foreground">Unknown</p>
              </CardContent>
            </Card>
          </div>

          {/* Firewall Rules */}
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-foreground">Stored Firewall Rule Definitions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rules === null ? (
                  <p className="text-muted-foreground text-sm">Firewall rule data unavailable.</p>
                ) : rules.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No firewall rules configured.</p>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${rule.status === 'active' ? 'bg-accent-emerald' : 'bg-muted-foreground'}`} />
                        <span className="font-medium text-foreground">{rule.rule_name}</span>
                        <Badge variant="outline" className="border-border text-muted-foreground text-xs">{rule.direction}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Ports: {rule.ports}</span>
                        <span className="text-muted-foreground font-mono text-xs">{rule.source_cidr}</span>
                        <Badge variant="outline" className="text-foreground border-border">{rule.action}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Alerts */}
          <Card className="bento-card overflow-hidden !p-0">
            <CardHeader>
              <CardTitle className="text-foreground">Recorded Security Alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {alerts === null ? (
                <p className="text-muted-foreground text-sm px-6 pb-6">Security alert data unavailable.</p>
              ) : alerts.length === 0 ? (
                <p className="text-muted-foreground text-sm px-6 pb-6">
                  No recorded security alerts. The read-only agent finding feed is not connected.
                </p>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[860px]">
                  <thead>
                    <tr className="border-b border-border bg-surface/60">
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Alert ID</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Severity</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert, idx) => (
                      <tr key={alert.id} className={`border-b border-border/60 hover:bg-surface/60 ${idx === alerts.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-6 py-4 font-mono text-foreground">{alert.alert_code ?? alert.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 text-foreground">{alert.alert_type.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-muted-foreground font-mono">{alert.source_ip ?? '—'}</td>
                        <td className="px-6 py-4">
                          <Badge className={
                            alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                            alert.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                            'bg-accent-amber/10 text-accent-amber'
                          }>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="border-border text-muted-foreground">{alert.status}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {alert.alert_type.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </CardContent>
          </Card>

          {/* Patch Status */}
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-foreground">Patch Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {patchStatus === null ? (
                  <p className="text-muted-foreground text-sm">Server list unavailable.</p>
                ) : patchStatus.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No servers found.</p>
                ) : (
                  patchStatus.map((server) => (
                    <div key={server.id} className="p-4 border border-border bg-surface/60 rounded-lg">
                      <p className="font-medium text-foreground mb-2">{server.server}</p>
                      <p className="text-sm text-muted-foreground">Unknown — agent data unavailable</p>
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

export default SMSecurity;
