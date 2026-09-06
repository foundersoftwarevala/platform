import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, CheckCircle2, Clock, XCircle, RefreshCw,
  GitBranch, Server, Eye, RotateCcw, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface DeploymentRow {
  id: string;
  deployment_code: string;
  deployment_name: string;
  branch: string;
  commit_sha: string | null;
  environment: string;
  status: string;
  progress: number;
  duration_seconds: number | null;
  deployed_at: string;
  triggered_by: string | null;
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

const formatDuration = (secs: number | null) => {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

const SMDeployments = () => {
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await smQuery('deployments', () =>
        supabase
          .from('server_deployments')
          .select('*, server_instances(server_name)')
          .order('deployed_at', { ascending: false })
          .limit(50),
      );
      if (data === null) {
        setLoadError('Could not load deployments. Please retry.');
      }
    setDeployments(
      (data ?? []).map((d) => ({
        id: d.id,
        deployment_code: d.deployment_code,
        deployment_name: d.deployment_name,
        branch: d.branch,
        commit_sha: d.commit_sha,
        environment: d.environment,
        status: d.status,
        progress: d.progress,
        duration_seconds: d.duration_seconds,
        deployed_at: d.deployed_at,
        triggered_by: d.triggered_by,
        server_id: d.server_id,
        server_name:
          (d as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Unassigned',
      })),
    );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-accent-emerald" />;
      case 'pending':
      case 'running': return <Clock className="w-4 h-4 text-accent-amber animate-pulse" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
      pending: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
      running: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
      failed: 'bg-destructive/10 text-destructive border-destructive/30',
    };
    return styles[status] ?? styles['pending']!;
  };

  const handleRollback = async (d: DeploymentRow) => {
    setActingId(d.id);
    const ok = await smMutate(
      'trigger rollback',
      () =>
        supabase.from('server_deployments').insert({
          deployment_code: `DEP-${Date.now().toString(36).toUpperCase()}`,
          deployment_name: `${d.deployment_name} (rollback)`,
          branch: d.branch,
          commit_sha: d.commit_sha,
          environment: d.environment,
          status: 'success',
          progress: 100,
          duration_seconds: 30,
          server_id: d.server_id,
          triggered_by: 'manual-rollback',
        }),
      `Rollback initiated for ${d.deployment_name}`,
    );
    setActingId(null);
    if (ok) void loadData();
  };

  const handleRedeploy = async (d: DeploymentRow) => {
    setActingId(d.id);
    const ok = await smMutate(
      'trigger redeploy',
      () =>
        supabase.from('server_deployments').insert({
          deployment_code: `DEP-${Date.now().toString(36).toUpperCase()}`,
          deployment_name: d.deployment_name,
          branch: d.branch,
          commit_sha: d.commit_sha,
          environment: d.environment,
          status: 'running',
          progress: 0,
          server_id: d.server_id,
          triggered_by: 'manual-redeploy',
        }),
      `Redeploy triggered for ${d.deployment_name}`,
    );
    setActingId(null);
    if (ok) void loadData();
  };

  const filtered = useMemo(
    () =>
      deployments.filter(
        (d) =>
          (envFilter === 'all' || d.environment === envFilter) &&
          (statusFilter === 'all' || d.status === statusFilter),
      ),
    [deployments, envFilter, statusFilter],
  );

  const stats = useMemo(
    () => ({
      total: deployments.length,
      success: deployments.filter((d) => d.status === 'success').length,
      failed: deployments.filter((d) => d.status === 'failed').length,
      progress: deployments.filter((d) => d.status === 'pending' || d.status === 'running').length,
    }),
    [deployments],
  );

  const environments = useMemo(() => Array.from(new Set(deployments.map((d) => d.environment))), [deployments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        subtitle="Manage and monitor server deployments"
        action={
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Deployments', value: stats.total, icon: Rocket, color: 'text-primary', bg: 'bg-primary/15' },
          { label: 'Successful', value: stats.success, icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
          { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'In Progress', value: stats.progress, icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${stat.color === 'text-primary' ? '' : stat.color}`}>{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Environments</SelectItem>
            {environments.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Recent Deployments ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No deployments match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((deployment, i) => (
                <motion.div
                  key={deployment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface/60 border border-border/60 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <p className="font-medium">{deployment.deployment_name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {deployment.branch}
                        </span>
                        <span className="flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          {deployment.server_name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {deployment.environment}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm">{formatRelative(deployment.deployed_at)}</p>
                      <p className="text-muted-foreground text-xs">Duration: {formatDuration(deployment.duration_seconds)}</p>
                    </div>
                    <Badge variant="outline" className={getStatusBadge(deployment.status)}>
                      {deployment.status}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toast.info(deployment.commit_sha ? `Commit ${deployment.commit_sha}` : 'No commit info')}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {deployment.status === 'success' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-accent-amber"
                          disabled={actingId === deployment.id}
                          onClick={() => void handleRollback(deployment)}
                        >
                          {actingId === deployment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </Button>
                      )}
                      {deployment.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary"
                          disabled={actingId === deployment.id}
                          onClick={() => void handleRedeploy(deployment)}
                        >
                          {actingId === deployment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SMDeployments;
