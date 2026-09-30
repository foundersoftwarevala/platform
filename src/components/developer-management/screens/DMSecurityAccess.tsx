/**
 * SECURITY & ACCESS
 * Access Level • Session Control • IP/Device Binding
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Monitor, Wifi, Smartphone, Ban, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperActivity, useDeveloperRegistry, useSetDeveloperStatus } from '@/hooks/useDevManagerData';

// Only the network part is shown, as before: 192.168.1.20 -> 192.168.x.x.
const maskIp = (ip: string | null) => {
  if (!ip) return 'Not recorded';
  const v4 = ip.split('.');
  return v4.length === 4 ? `${v4[0]}.${v4[1]}.x.x` : `${ip.split(':').slice(0, 2).join(':')}:…`;
};

const getAccessBadge = (level: string) => {
  switch (level) {
    case 'full': return <Badge className="bg-green-500/20 text-green-500">Full Access</Badge>;
    case 'limited': return <Badge className="bg-amber-500/20 text-amber-500">Limited</Badge>;
    case 'restricted': return <Badge variant="destructive">Restricted</Badge>;
    default: return <Badge>{level}</Badge>;
  }
};

/**
 * Developer access, from the registry and the developers' activity log. Five
 * developers with invented sessions and devices sat here. Access follows the
 * developer's status: active developers have access, a suspended or exited one
 * has none. The last IP and device are from their latest logged activity.
 * Lock Access suspends the developer, with the reason given, and is audited.
 * Session counts and temporary grants do not exist on the platform.
 */
export const DMSecurityAccess: React.FC = () => {
  const registry = useDeveloperRegistry();
  const activity = useDeveloperActivity(500);
  const setStatus = useSetDeveloperStatus();
  const securityData = (registry.data ?? []).map((d) => {
    const last = (activity.data ?? []).find((a) => a.developerId === d.id);
    const locked = d.status !== 'active';
    return {
      id: d.valaId || d.fullName,
      uuid: d.id,
      level: locked ? 'restricted' : d.onboardingCompleted ? 'full' : 'limited',
      sessions: null as number | null,
      ip: maskIp(last?.ip ?? null),
      device: last?.device ?? 'Not recorded',
      status: locked ? 'locked' : 'active',
    };
  });
  const lock = (developerId: string, name: string) => {
    const reason = window.prompt(`Why is access for ${name} being locked? (at least 5 characters)`)?.trim();
    if (!reason || reason.length < 5) { toast.error('A reason of at least 5 characters is needed.'); return; }
    setStatus.mutate({ developerId, status: 'suspended', reason });
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security & Access</h1>
        <p className="text-muted-foreground">Developer access control and session management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(registry.isLoading || registry.isError || securityData.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {registry.isLoading ? 'Loading…' : registry.isError ? `The registry could not be read: ${(registry.error as Error).message}` : 'No developer is registered.'}
              </p>
            )}
            {securityData.map((dev) => (
              <div 
                key={dev.uuid}
                className={`p-4 rounded-lg border ${dev.status === 'locked' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{dev.id}</span>
                    {getAccessBadge(dev.level)}
                    <Badge variant={dev.status === 'active' ? 'default' : 'destructive'}>
                      {dev.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{dev.sessions == null ? 'Sessions not tracked' : `${dev.sessions} active session(s)`}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span>IP: {dev.ip}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span>Device: {dev.device}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => lock(dev.uuid, dev.id)}
                    disabled={dev.status === 'locked' || setStatus.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Lock Access
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info('Temporary grants are not supported. A locked developer is reactivated from the Developer Registry.')}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Temporary Grant
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMSecurityAccess;
