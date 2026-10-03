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
import { useTranslation, type Translate } from '@/lib/i18n/use-translation';
import { useDMPrompt } from '../DMPromptDialog';

// Only the network part is shown, as before: 192.168.1.20 -> 192.168.x.x.
// Null when nothing was recorded; the screen says so in the reader's language.
const maskIp = (ip: string | null) => {
  if (!ip) return null;
  const v4 = ip.split('.');
  return v4.length === 4 ? `${v4[0]}.${v4[1]}.x.x` : `${ip.split(':').slice(0, 2).join(':')}:…`;
};

const getAccessBadge = (level: string, t: Translate) => {
  switch (level) {
    case 'full': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.security.access_full')}</Badge>;
    case 'limited': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.security.access_limited')}</Badge>;
    case 'restricted': return <Badge variant="destructive">{t('devmanager.security.access_restricted')}</Badge>;
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
  const { t } = useTranslation();
  const prompt = useDMPrompt();
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
      device: last?.device ?? null,
      status: locked ? 'locked' : 'active',
    };
  });
  const lock = async (developerId: string, name: string) => {
    const answer = await prompt.ask({
      title: t('devmanager.security.lock_prompt', { name }),
      reasonLabel: t('devmanager.prompt.reason'),
      minLength: 5,
      confirmLabel: t('devmanager.security.lock_access'),
    });
    if (!answer) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    setStatus.mutate({ developerId, status: 'suspended', reason });
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.security.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.security.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('devmanager.security.access_control')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(registry.isLoading || registry.isError || securityData.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={registry.isError ? 'alert' : 'status'}
                aria-live={registry.isError ? undefined : 'polite'}
                aria-busy={registry.isLoading || undefined}
              >
                {registry.isLoading
                  ? t('devmanager.common.loading')
                  : registry.isError
                    ? t('devmanager.common.registry_error', { error: (registry.error as Error).message })
                    : t('devmanager.common.no_developer')}
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
                    {getAccessBadge(dev.level, t)}
                    <Badge variant={dev.status === 'active' ? 'default' : 'destructive'}>
                      {dev.status === 'active' ? t('devmanager.security.status_active') : t('devmanager.security.status_locked')}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {dev.sessions == null
                      ? t('devmanager.security.sessions_not_tracked')
                      : t('devmanager.security.sessions', { count: dev.sessions })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.security.ip', { ip: dev.ip ?? t('devmanager.security.not_recorded') })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.security.device', { device: dev.device ?? t('devmanager.security.not_recorded') })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void lock(dev.uuid, dev.id)}
                    disabled={dev.status === 'locked' || setStatus.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    {t('devmanager.security.lock_access')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(t('devmanager.security.temporary_grant_info'))}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {t('devmanager.security.temporary_grant')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {prompt.dialog}
    </div>
  );
};

export default DMSecurityAccess;
