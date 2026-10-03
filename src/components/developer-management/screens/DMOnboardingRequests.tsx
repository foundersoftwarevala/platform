/**
 * ONBOARDING REQUESTS
 * New Join → Document Check → NDA Review → Skill Validation → Boss Approval
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, FileCheck, Shield, Award, Crown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useCompleteOnboarding, useDeveloperRegistry, useSetDeveloperStatus } from '@/hooks/useDevManagerData';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { MessageKey } from '@/lib/i18n/messages';
import { useDMPrompt } from '../DMPromptDialog';

const stepIcons = {
  join: UserPlus,
  docs: FileCheck,
  nda: Shield,
  skill: Award,
  boss: Crown,
};

const STEPS: { key: keyof typeof stepIcons; label: MessageKey }[] = [
  { key: 'join', label: 'devmanager.onboarding.step_join' },
  { key: 'docs', label: 'devmanager.onboarding.step_docs' },
  { key: 'nda', label: 'devmanager.onboarding.step_nda' },
  { key: 'skill', label: 'devmanager.onboarding.step_skill' },
  { key: 'boss', label: 'devmanager.onboarding.step_boss' },
];

/**
 * Developers still onboarding, from the developer registry. The three
 * candidates here were typed in and the buttons only showed messages.
 * Approve marks onboarding complete, and Reject exits the developer with the
 * reason given - both audited. Documents and the NDA are not recorded per
 * developer, so those steps show as not done until they are.
 */
export const DMOnboardingRequests: React.FC = () => {
  const { t } = useTranslation();
  const prompt = useDMPrompt();
  const registry = useDeveloperRegistry();
  const approve = useCompleteOnboarding();
  const setStatus = useSetDeveloperStatus();
  const onboardingRequests = (registry.data ?? [])
    .filter((d) => !d.onboardingCompleted && d.status !== 'exited')
    .map((d) => ({
      id: d.valaId || d.id.slice(0, 8).toUpperCase(),
      uuid: d.id,
      name: d.fullName,
      role: d.skillTags.length ? d.skillTags.slice(0, 3).join(', ') : t('devmanager.onboarding.skills_not_set'),
      steps: { join: true, docs: false, nda: false, skill: d.skillTags.length > 0, boss: false },
    }));
  const ask = async (question: string, label: string, confirmLabel: string) => {
    const result = await prompt.ask({ title: question, reasonLabel: label, minLength: 5, confirmLabel });
    if (!result) return null;
    const answer = result.reason?.trim();
    if (!answer || answer.length < 5) { toast.error(t('devmanager.onboarding.too_short')); return null; }
    return answer;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.onboarding.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.onboarding.subtitle')}</p>
      </div>

      {/* Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('devmanager.onboarding.flow')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((step, idx) => {
              const Icon = stepIcons[step.key];
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-muted">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs">{t(step.label)}</span>
                  </div>
                  {idx < 4 && <div className="flex-1 h-px bg-border mx-2" />}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('devmanager.onboarding.pending')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(registry.isLoading || registry.isError || onboardingRequests.length === 0) && (
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
                    : t('devmanager.onboarding.empty')}
              </p>
            )}
            {onboardingRequests.map((request) => (
              <div
                key={request.uuid}
                className="p-4 bg-muted/30 rounded-lg border"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{request.id}</span>
                    <span className="text-sm">{request.name}</span>
                    <Badge variant="outline">{request.role}</Badge>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-4">
                  {Object.entries(request.steps).map(([key, done]) => {
                    const Icon = stepIcons[key as keyof typeof stepIcons];
                    return (
                      <div
                        key={key}
                        className={`p-2 rounded-full ${done ? 'bg-green-500/20' : 'bg-muted'}`}
                      >
                        <Icon className={`h-4 w-4 ${done ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={approve.isPending}
                    onClick={async () => {
                      const note = await ask(
                        t('devmanager.onboarding.approve_prompt', { name: request.name }),
                        t('devmanager.onboarding.approve_note'),
                        t('devmanager.common.approve'),
                      );
                      if (note) approve.mutate({ developerId: request.uuid, note });
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('devmanager.common.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={setStatus.isPending}
                    onClick={async () => {
                      const reason = await ask(
                        t('devmanager.onboarding.reject_prompt', { name: request.name }),
                        t('devmanager.prompt.reason'),
                        t('devmanager.onboarding.reject'),
                      );
                      if (reason) setStatus.mutate({ developerId: request.uuid, status: 'exited', reason });
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t('devmanager.onboarding.reject')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(t('devmanager.onboarding.hold_info'))}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {t('devmanager.onboarding.hold')}
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

export default DMOnboardingRequests;
