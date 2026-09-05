import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle, ExternalLink, RefreshCw, CheckCircle,
  Clock, XCircle, Link2, Edit, Eye, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import DataStateNotice from './DataStateNotice';

type BrokenStatus = 'down' | 'timeout' | 'error' | 'ssl_expired';

interface BrokenDemo {
  id: string;
  title: string;
  category: string;
  url: string;
  maskedUrl: string;
  status: BrokenStatus;
  lastChecked: string;
  downSince: string;
  errorCode: string;
  affectedClicks: number;
}

const relative = (iso: string | null): string => {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};

/** Classifies a failure from the real health/validation records. */
const classify = (error: string | null, httpStatus: number | null): BrokenStatus => {
  const text = (error ?? '').toLowerCase();
  if (text.includes('ssl') || text.includes('certificate')) return 'ssl_expired';
  if (text.includes('timeout') || text.includes('timed out') || text.includes('abort')) return 'timeout';
  if (httpStatus && httpStatus >= 500) return 'down';
  if (httpStatus && httpStatus >= 400) return 'error';
  return 'down';
};

const brokenAlertsKey = ['demo-manager', 'broken-demos'] as const;

const DemoBrokenAlerts = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { runHealthCheck } = useHealthCheck();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: brokenAlertsKey,
    queryFn: async (): Promise<BrokenDemo[]> => {
      const { data: demos, error: demosError } = await supabase
        .from('demos')
        .select('id, title, category, url, masked_url, status, last_health_check, updated_at')
        .in('status', ['down', 'maintenance', 'inactive'])
        .order('last_health_check', { ascending: false, nullsFirst: false })
        .limit(100);
      if (demosError) throw demosError;

      const rows = demos ?? [];
      if (rows.length === 0) return [];
      const ids = rows.map((d) => d.id);

      const [health, validations, clicks] = await Promise.all([
        supabase
          .from('demo_health')
          .select('demo_id, status, error_message, checked_at, response_time')
          .in('demo_id', ids)
          .order('checked_at', { ascending: false })
          .limit(500),
        supabase
          .from('demo_validation_logs')
          .select('demo_id, status, error_message, http_status, validated_at')
          .in('demo_id', ids)
          .order('validated_at', { ascending: false })
          .limit(500),
        supabase
          .from('demo_clicks')
          .select('demo_id')
          .in('demo_id', ids)
          .gte('clicked_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
          .limit(5000),
      ]);

      const latestHealth = new Map<string, NonNullable<typeof health.data>[number]>();
      (health.data ?? []).forEach((h) => {
        if (!latestHealth.has(h.demo_id)) latestHealth.set(h.demo_id, h);
      });
      const latestValidation = new Map<string, NonNullable<typeof validations.data>[number]>();
      (validations.data ?? []).forEach((v) => {
        if (v.demo_id && !latestValidation.has(v.demo_id)) latestValidation.set(v.demo_id, v);
      });
      const clickCounts = new Map<string, number>();
      (clicks.data ?? []).forEach((c) => {
        clickCounts.set(c.demo_id, (clickCounts.get(c.demo_id) ?? 0) + 1);
      });

      return rows.map((demo) => {
        const h = latestHealth.get(demo.id);
        const v = latestValidation.get(demo.id);
        const errorMessage = v?.error_message ?? h?.error_message ?? null;
        const httpStatus = v?.http_status ?? null;
        return {
          id: demo.id,
          title: demo.title ?? 'Untitled demo',
          category: demo.category ?? 'Uncategorised',
          url: demo.url ?? '—',
          maskedUrl: demo.masked_url ?? demo.url ?? '—',
          status: classify(errorMessage, httpStatus),
          lastChecked: relative(h?.checked_at ?? v?.validated_at ?? demo.last_health_check ?? null),
          downSince: relative(h?.checked_at ?? demo.updated_at ?? null),
          errorCode: httpStatus ? String(httpStatus) : (errorMessage ? errorMessage.slice(0, 24) : demo.status?.toUpperCase() ?? 'UNKNOWN'),
          affectedClicks: clickCounts.get(demo.id) ?? 0,
        };
      });
    },
  });

  const brokenDemos = useMemo(() => data ?? [], [data]);

  const getStatusBadge = (status: BrokenStatus) => {
    switch (status) {
      case 'down':
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Server Down</Badge>;
      case 'timeout':
        return <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30"><Clock className="w-3 h-3 mr-1" />Timeout</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'ssl_expired':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" />SSL Expired</Badge>;
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await runHealthCheck([id], 1);
      await queryClient.invalidateQueries({ queryKey: brokenAlertsKey });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleFixUrl = async (id: string) => {
    if (!newUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
    const { error: updateError } = await supabase
      .from('demos')
      .update({ url: newUrl.trim(), status: 'active' })
      .eq('id', id);
    if (updateError) {
      toast.error(`Could not update URL: ${updateError.message}`);
      return;
    }
    setEditingId(null);
    setNewUrl('');
    await queryClient.invalidateQueries({ queryKey: brokenAlertsKey });
    toast.success('Demo URL updated and demo marked active.');
  };

  const handleMarkResolved = async (id: string) => {
    const { error: updateError } = await supabase
      .from('demos')
      .update({ status: 'active' })
      .eq('id', id);
    if (updateError) {
      toast.error(`Could not update demo: ${updateError.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: brokenAlertsKey });
    toast.success('Demo marked as resolved');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-orange-400" />
            Broken Demo Alerts
          </h1>
          <p className="text-slate-400 mt-1">Monitor and fix broken demo links immediately</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-lg px-4 py-2">
            {brokenDemos.length} Issues Found
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <DataStateNotice
        isLoading={isLoading}
        error={error}
        isEmpty={brokenDemos.length === 0}
        hasSession={Boolean(session)}
        resource="broken demo alerts"
        loadingLabel="Checking live demo health records…"
        emptyIcon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
        emptyTitle="All Demos Operational"
        emptyDescription="No broken demos detected. All systems running smoothly."
        onRetry={() => refetch()}
      >
        {/* Critical Alert Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 border border-red-500/30 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-red-400">Critical: {brokenDemos.length} demos are currently offline</p>
              <p className="text-sm text-slate-400">
                Clicks in the last 7 days on affected demos: {brokenDemos.reduce((acc, d) => acc + d.affectedClicks, 0)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Broken Demos List */}
        <div className="space-y-4">
          {brokenDemos.map((demo, index) => (
            <motion.div
              key={demo.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-slate-900/50 border-red-500/30 backdrop-blur-xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{demo.title}</h3>
                        {getStatusBadge(demo.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-slate-500">Category:</span>
                          <span className="text-slate-300 ml-2">{demo.category}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Error Code:</span>
                          <span className="text-red-400 ml-2 font-mono">{demo.errorCode}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Down Since:</span>
                          <span className="text-orange-400 ml-2">{demo.downSince}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Last Checked:</span>
                          <span className="text-slate-300 ml-2">{demo.lastChecked}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Clicks (7d):</span>
                          <span className="text-red-400 ml-2">{demo.affectedClicks}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-500">URL:</span>
                          <code className="text-cyan-400 bg-slate-800/50 px-2 py-0.5 rounded">{demo.url}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-500">Masked:</span>
                          <code className="text-emerald-400 bg-slate-800/50 px-2 py-0.5 rounded">{demo.maskedUrl}</code>
                        </div>
                      </div>

                      {/* Edit URL Section */}
                      {editingId === demo.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-cyan-500/30"
                        >
                          <p className="text-sm text-cyan-400 mb-2">Enter new demo URL:</p>
                          <div className="flex gap-2">
                            <Input
                              value={newUrl}
                              onChange={(e) => setNewUrl(e.target.value)}
                              placeholder="https://new-demo-url.com"
                              className="flex-1 bg-slate-900/50 border-slate-700"
                            />
                            <Button
                              onClick={() => handleFixUrl(demo.id)}
                              className="bg-emerald-500 hover:bg-emerald-600"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Save & Fix
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => { setEditingId(null); setNewUrl(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefresh(demo.id)}
                        disabled={refreshingId === demo.id}
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshingId === demo.id ? 'animate-spin' : ''}`} />
                        Re-check
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(demo.id)}
                        className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Fix URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(demo.url, '_blank')}
                        className="border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Test Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkResolved(demo.id)}
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Fixed
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </DataStateNotice>
    </div>
  );
};

export default DemoBrokenAlerts;
