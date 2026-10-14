import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart3, Clock, CheckCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDeliveryOverview } from '@/hooks/useDevManagerData';
import type { DeveloperPerformanceDTO } from '@/lib/dev-manager.types';

const getTrendIcon = (trend: DeveloperPerformanceDTO['trend']) => {
  switch (trend) {
    case 'up': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
    default: return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-amber-400';
  return 'text-red-400';
};

export default function DevManagerPerformanceSnapshot() {
  const { data, isLoading, error } = useDeliveryOverview();
  const performance = data?.performance ?? [];

  const avgOnTimeRate = performance.length
    ? Math.round(performance.reduce((sum, d) => sum + d.onTimeRate, 0) / performance.length)
    : 0;
  const avgQualityScore = performance.length
    ? Math.round(performance.reduce((sum, d) => sum + d.qualityScore, 0) / performance.length)
    : 0;
  const totalCompleted = performance.reduce((sum, d) => sum + d.completedTasks, 0);

  return (
    <div className="space-y-4">
      {/* READ-ONLY Notice */}
      <div className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-lg">
        <Lock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">READ-ONLY VIEW</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-mono font-bold">{totalCompleted}</p>
            <p className="text-xs text-muted-foreground">Completed (30d)</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 text-blue-400" />
            <p className={`text-2xl font-mono font-bold ${getScoreColor(avgOnTimeRate)}`}>{avgOnTimeRate}%</p>
            <p className="text-xs text-muted-foreground">Avg On-Time</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-2 text-purple-400" />
            <p className={`text-2xl font-mono font-bold ${getScoreColor(avgQualityScore)}`}>{avgQualityScore}</p>
            <p className="text-xs text-muted-foreground">Avg Quality</p>
          </CardContent>
        </Card>
      </div>

      {/* Developer Performance List */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">
            DEVELOPER PERFORMANCE (30 DAYS)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground font-mono">Loading performance…</p>}
          {error && (
            <p className="text-sm text-red-400 font-mono">
              {error instanceof Error ? error.message : 'Failed to load performance'}
            </p>
          )}
          {performance.map((dev, idx) => (
            <motion.div
              key={dev.valaId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 bg-muted/40 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{dev.valaId}</span>
                  {getTrendIcon(dev.trend)}
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {dev.completedTasks} tasks
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">On-Time Rate</p>
                  <div className="flex items-center gap-2">
                    <Progress value={dev.onTimeRate} className="h-1.5 flex-1" />
                    <span className={`text-sm font-mono ${getScoreColor(dev.onTimeRate)}`}>
                      {dev.onTimeRate}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quality Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={dev.qualityScore} className="h-1.5 flex-1" />
                    <span className={`text-sm font-mono ${getScoreColor(dev.qualityScore)}`}>
                      {dev.qualityScore}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Avg Time</p>
                  <p className="text-sm font-mono text-foreground/80">{dev.avgCompletionTime}h</p>
                </div>
              </div>
            </motion.div>
          ))}
          {!isLoading && !error && performance.length === 0 && (
            <p className="text-sm text-muted-foreground">No completed tasks in the last 30 days.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
