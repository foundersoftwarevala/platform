import { useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { generateAgentToken, type AgentOs } from '@/lib/server-manager/agent-contract';
import { PageHeader } from '../layout/PageShell';

interface EnrollmentResult {
  serverId: string;
  agentId: string;
  status: string;
  token: string;
}

const SMAddServer = () => {
  const [serverName, setServerName] = useState('');
  const [os, setOs] = useState<AgentOs>('linux');
  const [provider, setProvider] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestCredentials, setRequestCredentials] = useState<{
    signature: string;
    key: string;
    token: string;
  } | null>(null);

  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sign in before connecting a server.');

      const request = {
        serverName: serverName.trim(),
        os,
        provider: provider.trim() || null,
        region: region.trim() || null,
      };
      const signature = JSON.stringify(request);
      const credentials = requestCredentials?.signature === signature
        ? requestCredentials
        : { signature, key: crypto.randomUUID(), token: generateAgentToken() };
      if (credentials !== requestCredentials) setRequestCredentials(credentials);

      const response = await fetch('/api/server-manager/enroll', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': credentials.key,
        },
        body: JSON.stringify({
          ...request,
          enrollmentKey: credentials.key,
          agentToken: credentials.token,
        }),
      });

      const result = (await response.json()) as {
        server_id?: unknown;
        agent_id?: unknown;
        status?: unknown;
        agent_token?: unknown;
        error?: unknown;
      };
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Server enrollment failed.');
      }
      if (
        typeof result.server_id !== 'string' ||
        typeof result.agent_id !== 'string' ||
        typeof result.status !== 'string' ||
        result.agent_token !== credentials.token
      ) {
        throw new Error('Server enrollment returned an invalid response.');
      }

      setEnrollment({
        serverId: result.server_id,
        agentId: result.agent_id,
        status: result.status,
        token: credentials.token,
      });
    } catch (err) {
      console.error('[server-manager] connect server failed', err);
      setError(err instanceof Error ? err.message : 'Server enrollment failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.token);
      setCopied(true);
    } catch (err) {
      console.error('[server-manager] copying enrollment token failed', err);
      setError('Could not copy the token. Select and copy it manually.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Connect Server" subtitle="Register a customer-owned server for read-only monitoring." />

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {enrollment ? (
        <Card className="bento-card premium-halo !p-0">
          <CardHeader className="flex flex-row items-start justify-between gap-4 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <CardTitle className="text-lg text-foreground">Server registered — waiting for agent</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Server profile {enrollment.serverId} is {enrollment.status}. No metrics are available until an agent sends a verified heartbeat.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">Pending agent</Badge>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 pt-0">
            <div className="space-y-2">
              <Label htmlFor="agent-enrollment-token">One-time agent enrollment token</Label>
              <div className="flex items-start gap-2">
                <code id="agent-enrollment-token" className="min-w-0 flex-1 break-all rounded-lg border border-border bg-surface p-3 text-xs">
                  {enrollment.token}
                </code>
                <Button type="button" variant="outline" onClick={() => void copyToken()}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Store this token securely. It is not saved in plaintext and cannot be recovered from this screen after you leave.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden="true" />
              <p>
                Agent software and the OS-specific installer are not available yet. Do not run a command from an untrusted source.
                This registration will remain pending until the signed, outbound-only agent is released.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Agent ID: {enrollment.agentId}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bento-card premium-halo !p-0">
          <CardHeader className="p-6">
            <CardTitle className="text-lg text-foreground">Server details</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <form className="max-w-2xl space-y-5" onSubmit={(event) => void handleConnect(event)}>
              <div className="space-y-2">
                <Label htmlFor="server-name">Server name</Label>
                <Input
                  id="server-name"
                  autoComplete="off"
                  maxLength={100}
                  required
                  value={serverName}
                  onChange={(event) => setServerName(event.target.value)}
                  placeholder="e.g. production-web-01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-os">Operating system</Label>
                <Select
                  value={os}
                  onValueChange={(value) => {
                    if (value === 'linux' || value === 'windows' || value === 'other') setOs(value);
                  }}
                >
                  <SelectTrigger id="server-os"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="server-provider">Provider <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="server-provider"
                    maxLength={100}
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    placeholder="Cloud provider"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server-region">Region <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="server-region"
                    maxLength={100}
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="Region or location"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-4 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p>No SSH, root password, private key, provisioning, or remote command is requested or stored.</p>
              </div>
              <Button type="submit" disabled={busy || !serverName.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? 'Registering…' : 'Register server'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SMAddServer;
