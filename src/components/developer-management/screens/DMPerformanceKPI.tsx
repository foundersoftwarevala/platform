/**
 * PERFORMANCE & KPI
 * Task Completion • Bug Ratio • SLA Adherence • AI Quality Score
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, CheckCircle, Bug, Clock, Brain } from 'lucide-react';
import { useAllDeveloperTasks, useDeliveryOverview, useDeveloperRegistry } from '@/hooks/useDevManagerData';

type Row = { id: string; completion: number | null; bugRatio: number | null; sla: number | null; aiScore: number | null };
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
const avg = (list: (number | null)[]) => {
  const v = list.filter((n): n is number => n != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/**
 * Developer KPIs, from developer_tasks.
 *
 * Five developers with typed-in scores used to sit here. Per registered
 * developer now: completion is completed tasks over tasks assigned; bug ratio
 * is the share of their tasks filed in the "bug" category; SLA is the share of
 * completed tasks delivered by their deadline; the quality score is the
 * reviewers' average. A figure with nothing behind it shows a dash, not zero.
 */
export const DMPerformanceKPI: React.FC = () => {
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const overview = useDeliveryOverview();
  const perf = overview.data?.performance ?? [];
  const developers: Row[] = (registry.data ?? []).map((dev) => {
    const mine = (tasks.data ?? []).filter((t) => t.developerId === dev.id);
    const done = mine.filter((t) => t.status === 'completed').length;
    const p = perf.find((x) => x.valaId === dev.valaId || x.valaId === dev.fullName);
    return {
      id: dev.valaId || dev.fullName,
      completion: mine.length ? Math.round((done / mine.length) * 100) : null,
      bugRatio: mine.length ? Math.round((mine.filter((t) => t.category === 'bug').length / mine.length) * 100) : null,
      sla: p && p.completedTasks > 0 ? p.onTimeRate : null,
      aiScore: p && p.qualityScore > 0 ? p.qualityScore : null,
    };
  });
  const loading = registry.isLoading || tasks.isLoading;
  const failure = (registry.error ?? tasks.error) as Error | null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance & KPI</h1>
        <p className="text-muted-foreground">Developer performance metrics</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Avg Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{pct(avg(developers.map((d) => d.completion)))}</div>
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
            <div className="text-3xl font-bold text-red-500">{pct(avg(developers.map((d) => d.bugRatio)))}</div>
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
            <div className="text-3xl font-bold text-blue-500">{pct(avg(developers.map((d) => d.sla)))}</div>
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
            <div className="text-3xl font-bold text-purple-500">{pct(avg(developers.map((d) => d.aiScore)))}</div>
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
            {(loading || failure || developers.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading…' : failure ? `Figures could not be read: ${failure.message}` : 'No developer is registered.'}
              </p>
            )}
            {developers.map((dev) => (
              <div key={dev.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{dev.id}</span>
                  <span className="text-sm text-muted-foreground">
                    Overall: {pct(avg([dev.completion, dev.bugRatio == null ? null : 100 - dev.bugRatio, dev.sla, dev.aiScore]))}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Completion</span>
                      <span className={(dev.completion ?? 0) >= 80 ? 'text-green-500' : 'text-amber-500'}>{pct(dev.completion)}</span>
                    </div>
                    <Progress value={dev.completion ?? 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Bug Ratio</span>
                      <span className={(dev.bugRatio ?? 0) <= 10 ? 'text-green-500' : 'text-red-500'}>{pct(dev.bugRatio)}</span>
                    </div>
                    <Progress value={dev.bugRatio == null ? 0 : 100 - dev.bugRatio} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>SLA</span>
                      <span className={(dev.sla ?? 0) >= 90 ? 'text-green-500' : 'text-amber-500'}>{pct(dev.sla)}</span>
                    </div>
                    <Progress value={dev.sla ?? 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>AI Score</span>
                      <span className={(dev.aiScore ?? 0) >= 80 ? 'text-purple-500' : 'text-amber-500'}>{pct(dev.aiScore)}</span>
                    </div>
                    <Progress value={dev.aiScore ?? 0} className="h-2" />
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
