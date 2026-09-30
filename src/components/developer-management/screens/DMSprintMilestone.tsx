/**
 * SPRINT / MILESTONE
 * Sprint Planning • Milestone Tracking • Delay Prediction (AI) • Risk Alerts
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, Brain, AlertTriangle } from 'lucide-react';
import { useDeliveryOverview } from '@/hooks/useDevManagerData';

/**
 * Sprints and milestones. Two sprints, three milestones, a "3 days" AI
 * prediction and two risk alerts were typed in here. The platform keeps no
 * sprint or milestone for developer work, so those lists say so rather than
 * invent any, and no prediction is claimed. The risk alerts are real: the
 * tasks at SLA risk and the blocked tasks from the delivery overview.
 */
export const DMSprintMilestone: React.FC = () => {
  const overview = useDeliveryOverview();
  const sprints: { id: string; name: string; start: string; end: string; progress: number; tasks: number; completed: number; status: string }[] = [];
  const milestones: { id: string; name: string; deadline: string; progress: number; status: string }[] = [];
  const riskAlerts = [
    ...(overview.data?.blocked ?? []).map((b) => ({ task: b.code, reason: `Blocked: ${b.blockedReason}`, delay: `${Math.round(b.blockedHours)} h blocked` })),
    ...(overview.data?.risks ?? []).map((r) => ({
      task: r.code,
      reason: r.title,
      delay: r.hoursRemaining < 0 ? `${Math.abs(Math.round(r.hoursRemaining))} h late` : `${Math.round(r.hoursRemaining)} h left`,
    })),
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sprint / Milestone</h1>
        <p className="text-muted-foreground">Track sprints and project milestones</p>
      </div>

      {/* Sprint Planning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sprint Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sprints.length === 0 && <p className="text-sm text-muted-foreground">Sprints are not recorded for developer work yet.</p>}
            {sprints.map((sprint) => (
              <div key={sprint.id} className="p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{sprint.id}</span>
                    <span className="font-medium">{sprint.name}</span>
                    <Badge variant={sprint.status === 'active' ? 'default' : 'secondary'}>
                      {sprint.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{sprint.start} → {sprint.end}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={sprint.progress} className="flex-1 h-2" />
                  <span className="text-sm">{sprint.completed}/{sprint.tasks} tasks</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestone Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Milestone Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestones.length === 0 && <p className="text-sm text-muted-foreground">Milestones are not recorded for developer work yet.</p>}
            {milestones.map((ms) => (
              <div key={ms.id} className={`p-4 rounded-lg border ${ms.status === 'at_risk' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{ms.name}</span>
                    <Badge variant={ms.status === 'at_risk' ? 'destructive' : 'default'}>
                      {ms.status === 'at_risk' ? 'At Risk' : 'On Track'}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">Due: {ms.deadline}</span>
                </div>
                <Progress value={ms.progress} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Delay Prediction */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-purple-500">
              <Brain className="h-5 w-5" />
              AI Delay Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-2">—</div>
              <p className="text-sm text-muted-foreground">No delay-prediction model is connected, and there is no sprint to predict.</p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground">{overview.isLoading ? 'Loading…' : overview.isError ? 'Risks could not be read.' : 'No task at risk.'}</p>
              )}
              {riskAlerts.map((alert, idx) => (
                <div key={idx} className="p-2 bg-background rounded text-sm">
                  <span className="font-mono">{alert.task}</span>: {alert.reason} ({alert.delay})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DMSprintMilestone;
