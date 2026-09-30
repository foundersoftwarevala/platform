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

const stepIcons = {
  join: UserPlus,
  docs: FileCheck,
  nda: Shield,
  skill: Award,
  boss: Crown,
};

/**
 * Developers still onboarding, from the developer registry. The three
 * candidates here were typed in and the buttons only showed messages.
 * Approve marks onboarding complete, and Reject exits the developer with the
 * reason given - both audited. Documents and the NDA are not recorded per
 * developer, so those steps show as not done until they are.
 */
export const DMOnboardingRequests: React.FC = () => {
  const registry = useDeveloperRegistry();
  const approve = useCompleteOnboarding();
  const setStatus = useSetDeveloperStatus();
  const onboardingRequests = (registry.data ?? [])
    .filter((d) => !d.onboardingCompleted && d.status !== 'exited')
    .map((d) => ({
      id: d.valaId || d.id.slice(0, 8).toUpperCase(),
      uuid: d.id,
      name: d.fullName,
      role: d.skillTags.length ? d.skillTags.slice(0, 3).join(', ') : 'Skills not set',
      steps: { join: true, docs: false, nda: false, skill: d.skillTags.length > 0, boss: false },
    }));
  const ask = (question: string) => {
    const answer = window.prompt(question)?.trim();
    if (!answer || answer.length < 5) { toast.error('At least 5 characters are needed.'); return null; }
    return answer;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Onboarding Requests</h1>
        <p className="text-muted-foreground">New developer onboarding pipeline</p>
      </div>

      {/* Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Onboarding Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto">
            {[
              { key: 'join', label: 'New Join' },
              { key: 'docs', label: 'Documents' },
              { key: 'nda', label: 'NDA Review' },
              { key: 'skill', label: 'Skill Validation' },
              { key: 'boss', label: 'Boss Approval' },
            ].map((step, idx) => {
              const Icon = stepIcons[step.key as keyof typeof stepIcons];
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-muted">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs">{step.label}</span>
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
          <CardTitle className="text-lg">Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(registry.isLoading || registry.isError || onboardingRequests.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {registry.isLoading ? 'Loading…' : registry.isError ? `The registry could not be read: ${(registry.error as Error).message}` : 'No developer is waiting on onboarding.'}
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
                    onClick={() => { const note = ask(`Approve onboarding for ${request.name}? Add a note:`); if (note) approve.mutate({ developerId: request.uuid, note }); }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    disabled={setStatus.isPending}
                    onClick={() => { const reason = ask(`Why is ${request.name} rejected? They will be exited.`); if (reason) setStatus.mutate({ developerId: request.uuid, status: 'exited', reason }); }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info('Left as it is: it stays in this queue until approved or rejected.')}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Hold
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

export default DMOnboardingRequests;
