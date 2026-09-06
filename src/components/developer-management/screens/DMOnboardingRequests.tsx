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

const onboardingRequests = [
  { 
    id: 'ONB-001', 
    name: 'CANDIDATE-A1B2', 
    role: 'Full Stack', 
    step: 'nda_review',
    steps: { join: true, docs: true, nda: false, skill: false, boss: false }
  },
  { 
    id: 'ONB-002', 
    name: 'CANDIDATE-C3D4', 
    role: 'Frontend', 
    step: 'skill_validation',
    steps: { join: true, docs: true, nda: true, skill: false, boss: false }
  },
  { 
    id: 'ONB-003', 
    name: 'CANDIDATE-E5F6', 
    role: 'Backend', 
    step: 'boss_approval',
    steps: { join: true, docs: true, nda: true, skill: true, boss: false }
  },
];

const stepIcons = {
  join: UserPlus,
  docs: FileCheck,
  nda: Shield,
  skill: Award,
  boss: Crown,
};

export const DMOnboardingRequests: React.FC = () => {
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
          <div className="flex items-center justify-between">
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
            {onboardingRequests.map((request) => (
              <div 
                key={request.id}
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
                    onClick={() => toast.success(`${request.id} approved`)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => toast.error(`${request.id} rejected`)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(`${request.id} on hold`)}
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
