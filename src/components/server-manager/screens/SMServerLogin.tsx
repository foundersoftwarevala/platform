import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal, Key, Server, Shield, Clock, RefreshCw,
  CheckCircle, XCircle, Loader2, LogIn,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database as DB } from '@/integrations/supabase/types';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type SSHKeyRow = DB['public']['Tables']['server_ssh_keys']['Row'];
type LoginRow = DB['public']['Tables']['server_login_history']['Row'];

interface ServerLite {
  id: string;
  server_name: string;
  hostname: string | null;
  ip_address: string | null;
  ssh_port: number;
  status: string;
  os_type: string;
  region_name: string;
}

const SMServerLogin = () => {
  const [tab, setTab] = useState<'connect' | 'keys' | 'history'>('connect');
  const [servers, setServers] = useState<ServerLite[]>([]);
  const [keys, setKeys] = useState<SSHKeyRow[]>([]);
  const [history, setHistory] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [serverId, setServerId] = useState('');
  const [keyId, setKeyId] = useState('');
  const [username, setUsername] = useState('root');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [serverRows, keyRows, historyRows] = await Promise.all([
        smQuery('servers', () =>
          supabase
            .from('server_instances')
            .select('id, server_name, hostname, ip_address, ssh_port, status, os_type, region_name')
            .neq('status', 'decommissioned')
            .order('server_name'),
        ),
        smQuery('SSH keys', () => supabase.from('server_ssh_keys').select('*').order('added_at', { ascending: false })),
        smQuery('login history', () =>
          supabase
            .from('server_login_history')
            .select('*')
            .order('logged_at', { ascending: false })
            .limit(50),
        ),
      ]);

      if (serverRows === null || keyRows === null || historyRows === null) {
        setLoadError('Could not load server login data. Please try again.');
      }

      const serverList = (serverRows ?? []) as ServerLite[];
      setServers(serverList);
      setKeys((keyRows ?? []) as SSHKeyRow[]);
      setHistory((historyRows ?? []) as LoginRow[]);
      if (!serverId && serverList[0]) setServerId(serverList[0].id);
      const activeKey = ((keyRows ?? []) as SSHKeyRow[]).find((k) => k.is_active);
      if (!keyId && activeKey) setKeyId(activeKey.id);
    } finally {
      setLoading(false);
    }
  }, [serverId, keyId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === serverId) ?? null,
    [servers, serverId],
  );
  const selectedKey = useMemo(() => keys.find((k) => k.id === keyId) ?? null, [keys, keyId]);

  const sshCommand = selectedServer
    ? `ssh -i ~/.ssh/${(selectedKey?.key_name ?? 'id_ed25519').replace(/\s+/g, '_').toLowerCase()} -p ${selectedServer.ssh_port} ${username}@${selectedServer.ip_address ?? selectedServer.hostname ?? 'host'}`
    : '';

  const handleConnect = async () => {
    if (!selectedServer) return;
    setConnecting(true);
    const reachable = selectedServer.status === 'active';
    try {
      const ok = await smMutate(
        'Record SSH session',
        async () => {
          const { error } = await supabase.from('server_login_history').insert({
            server_id: selectedServer.id,
            server_label: selectedServer.server_name,
            username,
            method: selectedKey ? 'ssh-key' : 'password',
            ip_address: selectedServer.ip_address,
            status: reachable ? 'success' : 'failed',
            session_duration_minutes: reachable ? 0 : null,
            logged_at: new Date().toISOString(),
          });
          if (error) return { data: null, error };

          const { error: auditError } = await supabase.from('server_audit_logs').insert({
            action: `SSH session ${reachable ? 'opened' : 'attempt failed'} on ${selectedServer.server_name}`,
            actor: username,
            result: reachable ? 'success' : 'failure',
            risk_level: 'medium',
            server_id: selectedServer.id,
            ip_address: selectedServer.ip_address,
            details: sshCommand,
          });
          return { data: null, error: auditError };
        },
      );
      if (ok) {
        if (reachable) {
          toast.success(`Session recorded for ${selectedServer.server_name}`);
        } else {
          toast.error(`${selectedServer.server_name} is ${selectedServer.status} — connection refused`);
        }
        await load();
        setTab('history');
      }
    } finally {
      setConnecting(false);
    }
  };

  const toggleKey = async (key: SSHKeyRow) => {
    const ok = await smMutate(
      'Update SSH key',
      () => supabase.from('server_ssh_keys').update({ is_active: !key.is_active }).eq('id', key.id),
      `${key.key_name} ${key.is_active ? 'revoked' : 'activated'}`,
    );
    if (ok) await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Server Login"
        subtitle="SSH access, key management and login audit trail"
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
          { id: 'connect', label: 'Connect', icon: LogIn },
          { id: 'keys', label: 'SSH Keys', icon: Key },
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
              <CardTitle className="text-base text-foreground">Connection Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Server</Label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger className="bg-surface border-border text-foreground">
                    <SelectValue placeholder={loading ? 'Loading…' : 'Select server'} />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.server_name} — {s.region_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">SSH Key</Label>
                <Select value={keyId} onValueChange={setKeyId}>
                  <SelectTrigger className="bg-surface border-border text-foreground">
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.filter((k) => k.is_active).map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.key_name} ({k.key_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-surface border-border text-foreground"
                />
              </div>
              <Button
                onClick={() => void handleConnect()}
                disabled={connecting || !selectedServer || !username.trim()}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4 mr-2" />
                )}
                Open SSH Session
              </Button>
            </CardContent>
          </Card>

          <Card className="bento-card !p-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                {selectedServer?.server_name ?? 'No server selected'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedServer ? (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Hostname</p>
                      <p className="text-foreground font-mono">{selectedServer.hostname ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">IP Address</p>
                      <p className="text-foreground font-mono">{selectedServer.ip_address ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SSH Port</p>
                      <p className="text-foreground font-mono">{selectedServer.ssh_port}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Operating System</p>
                      <p className="text-foreground">{selectedServer.os_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge
                        className={
                          selectedServer.status === 'active'
                            ? 'bg-accent-emerald/20 text-accent-emerald'
                            : 'bg-destructive/20 text-destructive'
                        }
                      >
                        {selectedServer.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Key Fingerprint</p>
                      <p className="text-foreground font-mono text-xs break-all">
                        {selectedKey?.fingerprint ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">SSH Command</p>
                    <code className="text-sm text-accent-emerald break-all">{sshCommand}</code>
                  </div>
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground"
                    onClick={() => {
                      void navigator.clipboard.writeText(sshCommand);
                      toast.success('Command copied');
                    }}
                  >
                    Copy command
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Select a server to view connection details.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'keys' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {keys.length === 0 ? (
            <Card className="bento-card !p-0">
              <CardContent className="p-10 text-center text-muted-foreground">No SSH keys registered.</CardContent>
            </Card>
          ) : (
            keys.map((k) => (
              <Card key={k.id} className="bento-card !p-0">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-surface">
                      <Key className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">
                        {k.key_name}{' '}
                        <span className="text-xs text-muted-foreground font-mono">{k.key_code}</span>
                      </p>
                      <p className="text-xs text-muted-foreground font-mono break-all">{k.fingerprint}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {k.key_type} • {k.servers_count} servers • added{' '}
                        {new Date(k.added_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        k.is_active
                          ? 'bg-accent-emerald/20 text-accent-emerald'
                          : 'bg-surface text-muted-foreground'
                      }
                    >
                      {k.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border text-muted-foreground"
                      onClick={() => void toggleKey(k)}
                    >
                      {k.is_active ? 'Revoke' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
