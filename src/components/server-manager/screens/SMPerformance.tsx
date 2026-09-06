import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Target, BarChart3, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../layout/PageShell';

const RANGE_MINUTES: Record<string, number> = { '1h': 60, '6h': 360, '24h': 1440, '7d': 10080 };

interface ServerPerf {
  id: string;
  server: string;
  score: number;
  sla: number;
  responseTime: number;
  errorRate: number;
}

interface TrendPoint {
  label: string;
  score: number;
  change: string;
}

const SMPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [perfData, setPerfData] = useState<ServerPerf[]>([]);
  const [avgSla, setAvgSla] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [downtimeMinutes, setDowntimeMinutes] = useState(0);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-accent-emerald';
    if (score >= 70) return 'text-accent-amber';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-accent-emerald/20';
    if (score >= 70) return 'bg-accent-amber/20';
    return 'bg-destructive/20';
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const minutes = RANGE_MINUTES[timeRange] ?? 1440;
      const since = new Date(Date.now() - minutes * 60_000).toISOString();

      const [servers, history] = await Promise.all([
        smQuery('server performance', () =>
          supabase
            .from('server_instances')
            .select('id, server_name, health_score, sla_percent, response_time_ms, error_rate')
            .neq('status', 'decommissioned')
            .order('health_score', { ascending: true }),
        ),
        smQuery('performance history', () =>
          supabase
            .from('server_metrics_history')
            .select('recorded_at, response_time_ms, request_count, error_count')
            .gte('recorded_at', since)
            .order('recorded_at', { ascending: true }),
        ),
      ]);

      if (servers === null || history === null) {
        setLoadError('Failed to load performance data.');
        return;
      }
      setLoadError(null);

    const rows = servers ?? [];
    setPerfData(
      rows.map((s) => ({
        id: s.id,
        server: s.server_name,
        score: Math.round(Number(s.health_score || 0)),
        sla: Number(s.sla_percent || 0),
        responseTime: Math.round(Number(s.response_time_ms || 0)),
        errorRate: Number(s.error_rate || 0),
      })),
    );

    setAvgSla(rows.length ? rows.reduce((a, r) => a + Number(r.sla_percent || 0), 0) / rows.length : 0);
    setAvgResponseTime(
      rows.length ? Math.round(rows.reduce((a, r) => a + Number(r.response_time_ms || 0), 0) / rows.length) : 0,
    );

    const pts = history ?? [];
    const totalRequests = pts.reduce((a, p) => a + Number(p.request_count || 0), 0);
    const totalErrors = pts.reduce((a, p) => a + Number(p.error_count || 0), 0);
    // Estimate downtime minutes from buckets with error rate over 20%
    const badBuckets = pts.filter((p) => {
      const req = Number(p.request_count || 0);
      const err = Number(p.error_count || 0);
      return req > 0 && err / req > 0.2;
    }).length;
    setDowntimeMinutes(badBuckets * 5);

    // Bucket history into 3 periods for trend comparison (early/mid/late)
    const bucketCount = 3;
    const labels = ['Early', 'Mid', 'Recent'];
    const size = Math.max(1, Math.ceil(pts.length / bucketCount));
    const buckets: TrendPoint[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const slice = pts.slice(i * size, (i + 1) * size);
      if (!slice.length) continue;
      const avgResp = slice.reduce((a, p) => a + Number(p.response_time_ms || 0), 0) / slice.length;
      const score = Math.max(0, Math.round(100 - avgResp / 5));
      buckets.push({ label: labels[i] ?? `P${i}`, score, change: '' });
    }
    for (let i = 1; i < buckets.length; i++) {
      const cur = buckets[i];
      const prev = buckets[i - 1];
      if (!cur || !prev) continue;
      const delta = cur.score - prev.score;
      cur.change = `${delta >= 0 ? '+' : ''}${delta}%`;
    }
    setTrends(buckets);
      void totalRequests;
      void totalErrors;
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const slaCircumference = 352;
  const slaOffset = Math.max(0, Math.min(slaCircumference, (avgSla / 100) * slaCircumference));

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      <PageHeader
        title="Performance & Tracking"
        subtitle="Server performance metrics, SLA tracking, and trends"
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
          <div className="grid grid-cols-3 gap-4">
            {trends.length === 0 ? (
              <div className="bento-card col-span-3">
                <p className="text-muted-foreground text-sm">No historical trend data available yet.</p>
              </div>
            ) : (
              trends.map((data) => (
                <div key={data.label} className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground capitalize">{data.label} Average</span>
                    {data.change && (
                      <div className={`flex items-center gap-1 text-sm ${data.change.startsWith('-') ? 'text-destructive' : 'text-accent-emerald'}`}>
                        {data.change.startsWith('-') ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {data.change}
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="mt-1 text-xl font-bold">{data.score}</p>
                    <span className="text-muted-foreground">/ 100</span>
                  </div>
                </div>
              ))
            )}
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
                  <motion.circle
                    cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" strokeLinecap="round"
                    className="text-accent-emerald"
                    initial={{ strokeDasharray: '0 352' }}
                    animate={{ strokeDasharray: `${slaOffset} ${slaCircumference}` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{avgSla.toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Target SLA</span>
                  <span className="font-medium">99.5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current SLA</span>
                  <span className={avgSla >= 99.5 ? 'text-accent-emerald font-medium' : 'text-accent-amber font-medium'}>{avgSla.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Response Time</span>
                  <span className="font-medium">{avgResponseTime}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. Downtime ({timeRange})</span>
                  <span className="font-medium">{downtimeMinutes}m</span>
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
                <p className="text-muted-foreground text-sm">No servers found.</p>
              ) : (
                perfData.map((server, i) => (
                  <motion.div
                    key={server.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-xl bg-surface/60 border border-border"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${getScoreBg(server.score)} flex items-center justify-center`}>
                          <span className={`font-bold ${getScoreColor(server.score)}`}>{server.score}</span>
                        </div>
                        <div>
                          <p className="font-medium">{server.server}</p>
                          <p className="text-muted-foreground text-sm">Performance Score</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-accent-emerald font-medium">{server.sla}%</p>
                          <p className="text-muted-foreground text-xs">SLA Uptime</p>
                        </div>
                        <div className="text-center">
                          <p className="text-primary font-medium">{server.responseTime}ms</p>
                          <p className="text-muted-foreground text-xs">Response</p>
                        </div>
                        <div className="text-center">
                          <p className={`font-medium ${server.errorRate > 0.1 ? 'text-accent-amber' : 'text-accent-emerald'}`}>
                            {server.errorRate}%
                          </p>
                          <p className="text-muted-foreground text-xs">Error Rate</p>
                        </div>
                      </div>
                    </div>
                    <Progress value={server.score} className="h-1.5" />
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

export default SMPerformance;
