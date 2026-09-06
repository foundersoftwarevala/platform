/**
 * SPRINT / MILESTONE
 * Sprint Planning • Milestone Tracking • Delay Prediction (AI) • Risk Alerts
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, Brain, AlertTriangle } from 'lucide-react';

const sprints = [
  { id: 'SPR-001', name: 'Sprint 23', start: '2024-01-15', end: '2024-01-29', progress: 65, tasks: 12, completed: 8, status: 'active' },
  { id: 'SPR-002', name: 'Sprint 24', start: '2024-01-29', end: '2024-02-12', progress: 0, tasks: 15, completed: 0, status: 'planned' },
];

const milestones = [
  { id: 'MS-001', name: 'Alpha Release', deadline: '2024-02-01', progress: 78, status: 'on_track' },
  { id: 'MS-002', name: 'Beta Release', deadline: '2024-03-01', progress: 45, status: 'at_risk' },
  { id: 'MS-003', name: 'Production Release', deadline: '2024-04-01', progress: 20, status: 'on_track' },
];

const riskAlerts = [
  { task: 'TSK-004', reason: 'Blocked by dependency', delay: '2 days', severity: 'high' },
  { task: 'TSK-008', reason: 'Developer unavailable', delay: '1 day', severity: 'medium' },
];

export const DMSprintMilestone: React.FC = () => {
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

      <div className="grid grid-cols-2 gap-4">
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
              <div className="text-4xl font-bold text-purple-500 mb-2">3 days</div>
              <p className="text-sm text-muted-foreground">Predicted delay for current sprint</p>
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
              {riskAlerts.map((alert, idx) => (
                <div key={idx} className="p-2 bg-background rounded text-sm">
                  <span className="font-mono">{alert.task}</span>: {alert.reason} (+{alert.delay})
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
