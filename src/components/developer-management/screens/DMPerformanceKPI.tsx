/**
 * PERFORMANCE & KPI
 * Task Completion • Bug Ratio • SLA Adherence • AI Quality Score
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, CheckCircle, Bug, Clock, Brain } from 'lucide-react';

const developers = [
  { id: 'DEV-001', completion: 92, bugRatio: 8, sla: 95, aiScore: 88 },
  { id: 'DEV-002', completion: 78, bugRatio: 15, sla: 82, aiScore: 72 },
  { id: 'DEV-003', completion: 95, bugRatio: 5, sla: 98, aiScore: 94 },
  { id: 'DEV-004', completion: 65, bugRatio: 22, sla: 70, aiScore: 60 },
  { id: 'DEV-005', completion: 88, bugRatio: 10, sla: 90, aiScore: 85 },
];

export const DMPerformanceKPI: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance & KPI</h1>
        <p className="text-muted-foreground">Developer performance metrics</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Avg Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">84%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Avg Bug Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">12%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              SLA Adherence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">87%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-500">80%</div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Individual Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {developers.map((dev) => (
              <div key={dev.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{dev.id}</span>
                  <span className="text-sm text-muted-foreground">
                    Overall: {Math.round((dev.completion + (100 - dev.bugRatio) + dev.sla + dev.aiScore) / 4)}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Completion</span>
                      <span className={dev.completion >= 80 ? 'text-green-500' : 'text-amber-500'}>{dev.completion}%</span>
                    </div>
                    <Progress value={dev.completion} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Bug Ratio</span>
                      <span className={dev.bugRatio <= 10 ? 'text-green-500' : 'text-red-500'}>{dev.bugRatio}%</span>
                    </div>
                    <Progress value={100 - dev.bugRatio} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>SLA</span>
                      <span className={dev.sla >= 90 ? 'text-green-500' : 'text-amber-500'}>{dev.sla}%</span>
                    </div>
                    <Progress value={dev.sla} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>AI Score</span>
                      <span className={dev.aiScore >= 80 ? 'text-purple-500' : 'text-amber-500'}>{dev.aiScore}%</span>
                    </div>
                    <Progress value={dev.aiScore} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMPerformanceKPI;
