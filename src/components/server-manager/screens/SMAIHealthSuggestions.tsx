import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, AlertTriangle, CheckCircle, Zap, Shield,
  RefreshCw, Sparkles, Server, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database as DB } from '@/integrations/supabase/types';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type InsightRow = DB['public']['Tables']['server_ai_insights']['Row'];

interface ServerLite {
  id: string;
  server_name: string;
  health_score: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
  high: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
  warning: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
  medium: 'bg-accent-amber/20 text-accent-amber border-accent-amber/30',
  low: 'bg-primary/20 text-primary border-primary/30',
  info: 'bg-primary/20 text-primary border-primary/30',
};

const TYPE_ICONS: Record<string, typeof Brain> = {
  performance: TrendingUp,
  security: Shield,
  cost: Sparkles,
  capacity: Server,
  reliability: CheckCircle,
  optimization: Zap,
};

const SMAIHealthSuggestions = () => {
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [servers, setServers] = useState<Record<string, ServerLite>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'applied' | 'dismissed'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [insightRows, serverRows] = await Promise.all([
        smQuery('AI insights', () =>
          supabase
            .from('server_ai_insights')
            .select('*')
            .order('created_at', { ascending: false }),
        ),
        smQuery('servers', () => supabase.from('server_instances').select('id, server_name, health_score')),
      ]);

      if (insightRows === null || serverRows === null) {
        setLoadError('Could not load AI insights. Please try again.');
      }
      setInsights((insightRows ?? []) as InsightRow[]);
      setServers(
        Object.fromEntries(((serverRows ?? []) as ServerLite[]).map((s) => [s.id, s])),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (insight: InsightRow, status: 'applied' | 'dismissed') => {
    setBusyId(insight.id);
    try {
      const ok = await smMutate(
        `${status === 'applied' ? 'Apply' : 'Dismiss'} recommendation`,
        async () => {
          const { error } = await supabase
            .from('server_ai_insights')
            .update({
              status,
              applied_at: status === 'applied' ? new Date().toISOString() : null,
            })
            .eq('id', insight.id);
          if (error) return { data: null, error };

          const { error: auditError } = await supabase.from('server_audit_logs').insert({
            action: `${status === 'applied' ? 'Applied' : 'Dismissed'} AI recommendation "${insight.title}"`,
            actor: 'admin',
            result: 'success',
            risk_level: insight.severity === 'critical' ? 'high' : 'medium',
            server_id: insight.server_id,
            details: insight.recommendation,
          });
          return { data: null, error: auditError };
        },
        status === 'applied' ? 'Recommendation applied' : 'Recommendation dismissed',
      );
      if (ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? insights : insights.filter((i) => i.status === filter)),
    [insights, filter],
  );

  const stats = useMemo(() => {
    const pending = insights.filter((i) => i.status === 'pending').length;
    const applied = insights.filter((i) => i.status === 'applied').length;
    const critical = insights.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
    const avgConfidence = insights.length
      ? Math.round(insights.reduce((a, i) => a + i.confidence, 0) / insights.length)
      : 0;
    return { pending, applied, critical, avgConfidence };
  }, [insights]);

  const avgHealth = useMemo(() => {
    const list = Object.values(servers);
    return list.length
      ? Math.round(list.reduce((a, s) => a + Number(s.health_score || 0), 0) / list.length)
      : 0;
  }, [servers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Health Suggestions"
        subtitle="Recommendations generated from your live infrastructure telemetry"
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Fleet Health Score', value: `${avgHealth}%`, icon: Server, color: 'text-accent-emerald' },
          { label: 'Pending Suggestions', value: stats.pending, icon: Sparkles, color: 'text-primary' },
          { label: 'High Priority', value: stats.critical, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Avg Confidence', value: `${stats.avgConfidence}%`, icon: Brain, color: 'text-accent-pink' },
        ].map((s) => (
          <div key={s.label} className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-foreground">{s.value}</p>
              </div>
              <s.icon className={`w-8 h-8 ${s.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'applied', 'dismissed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bento-card">
          <CardContent className="p-10 text-center text-muted-foreground">Analyzing infrastructure…</CardContent>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bento-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            No {filter === 'all' ? '' : filter} recommendations right now.
          </CardContent>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((insight, index) => {
            const Icon = TYPE_ICONS[insight.insight_type] ?? Brain;
            const server = insight.server_id ? servers[insight.server_id] : undefined;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="bento-card premium-halo hover-lift !p-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-foreground">{insight.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          className={`border capitalize ${
                            SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES['low']
                          }`}
                        >
                          {insight.severity}
                        </Badge>
                        <Badge className="bg-surface text-foreground capitalize">
                          {insight.insight_type}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-lg bg-surface/50 border border-border">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recommendation</p>
                      <p className="text-sm text-foreground">{insight.recommendation}</p>
                      {insight.impact && (
                        <p className="text-sm text-accent-emerald mt-2">Expected impact: {insight.impact}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="md:col-span-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>AI confidence</span>
                          <span>{insight.confidence}%</span>
                        </div>
                        <Progress value={insight.confidence} className="h-2" />
                      </div>
                      <div className="text-sm text-muted-foreground md:text-right">
                        {server ? server.server_name : 'Fleet-wide'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        Detected {new Date(insight.created_at).toLocaleString()}
                        {insight.applied_at
                          ? ` • Applied ${new Date(insight.applied_at).toLocaleString()}`
                          : ''}
                      </span>
                      {insight.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === insight.id}
                            onClick={() => void updateStatus(insight, 'dismissed')}
                            className="text-foreground"
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            disabled={busyId === insight.id}
                            onClick={() => void updateStatus(insight, 'applied')}
                            
                          >
                            {busyId === insight.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 mr-2" />
                            )}
                            Apply
                          </Button>
                        </div>
                      ) : (
                        <Badge className="bg-surface text-foreground capitalize">{insight.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SMAIHealthSuggestions;
