import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Shield, Clock, RefreshCw, CheckCircle, XCircle, Loader2, LogIn,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Database as DB } from '@/integrations/supabase/types';
import { smQuery } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type LoginRow = DB['public']['Tables']['server_login_history']['Row'];

const SMServerLogin = () => {
  const [tab, setTab] = useState<'connect' | 'history'>('connect');
  const [history, setHistory] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const historyRows = await smQuery('login history', () =>
          supabase
            .from('server_login_history')
            .select('*')
            .order('logged_at', { ascending: false })
            .limit(50),
      );

      if (historyRows === null) {
        setLoadError('Could not load server login data. Please try again.');
      }

      setHistory((historyRows ?? []) as LoginRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Server Login"
        subtitle="Read-only server access history. SSH and password access are not used."
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

      <div className="flex gap-2">
        {([
          { id: 'connect', label: 'Connection', icon: LogIn },
          { id: 'history', label: 'Login History', icon: Clock },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connect' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bento-card !p-0 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Connection Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium text-foreground">SSH and password access are disabled.</p>
              <p className="text-sm text-muted-foreground">
                Server monitoring will use a read-only outbound agent. Agent onboarding is not available yet.
              </p>
            </CardContent>
          </Card>

          <Card className="bento-card !p-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Read-only monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No SSH command, credential, or customer-server session is created by this dashboard.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Recent Login Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-10 text-center text-muted-foreground">No login activity recorded.</p>
              ) : (
                <div className="divide-y divide-border">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        {h.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-accent-emerald" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <div>
                          <p className="text-foreground text-sm">
                            {h.username}@{h.server_label}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {h.method} • {h.ip_address ?? 'unknown IP'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.logged_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.session_duration_minutes != null
                            ? `${h.session_duration_minutes} min session`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default SMServerLogin;
