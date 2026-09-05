/**
 * Internal Support AI - Main Dashboard
 * Live Issue Overview, Auto-Fix Success Graph, Failures Heatmap, SLA Predictor
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Target,
  Shield,
  Brain,
  BarChart3,
  Gauge
} from 'lucide-react';
import { SupportMetrics } from '../types';

interface SupportDashboardProps {
  activeView: string;
}

export const SupportDashboard: React.FC<SupportDashboardProps> = ({ activeView }) => {
  const metrics: SupportMetrics = {
    activeIssues: 12,
    autoFixedToday: 87,
    escalatedIssues: 3,
    slaAtRisk: 2,
    avgResolutionTime: 4.2,
    aiConfidenceScore: 94.5,
    systemTrustIndex: 97.8,
    autoFixSuccessRate: 91.3
  };

  const liveIssues = [
    { id: 'ISS-001', type: 'UI Failure', user: 'USR-***42', status: 'analyzing', priority: 'high', time: '2m ago' },
    { id: 'ISS-002', type: 'API Error', user: 'USR-***87', status: 'auto_fixing', priority: 'medium', time: '5m ago' },
    { id: 'ISS-003', type: 'Permission', user: 'USR-***15', status: 'escalated', priority: 'critical', time: '8m ago' },
    { id: 'ISS-004', type: 'Performance', user: 'USR-***63', status: 'resolved', priority: 'low', time: '12m ago' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzing': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'auto_fixing': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'escalated': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-muted/40 text-muted-foreground';
      default: return 'bg-muted/40 text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Issues</p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">{metrics.activeIssues}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">-23% from yesterday</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Auto-Fixed Today</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.autoFixedToday}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">{metrics.autoFixSuccessRate}% success rate</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Escalated</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{metrics.escalatedIssues}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-400">{metrics.slaAtRisk} at SLA risk</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Resolution</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">{metrics.avgResolutionTime}m</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Target className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">Below 5m target</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Live Issues Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-2"
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Live Issue Overview
                </CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                  Real-time
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {liveIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-cyan-400">{issue.id}</span>
                      <span className="text-xs text-foreground">{issue.type}</span>
                      <Badge className={`${getPriorityBadge(issue.priority)} text-[9px] px-1.5`}>
                        {issue.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">{issue.user}</span>
                      <Badge className={`${getStatusBadge(issue.status)} border text-[9px] px-1.5`}>
                        {issue.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{issue.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Confidence & Trust Index */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                AI Confidence Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      className="text-foreground"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-purple-500"
                      strokeWidth="8"
                      strokeDasharray={`${metrics.aiConfidenceScore * 2.51} 251`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-purple-400">{metrics.aiConfidenceScore}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Based on pattern matching accuracy</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                System Trust Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Overall Trust</span>
                  <span className="text-sm font-bold text-emerald-400">{metrics.systemTrustIndex}%</span>
                </div>
                <Progress value={metrics.systemTrustIndex} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-card/60 rounded p-2">
                    <p className="text-muted-foreground">Uptime</p>
                    <p className="text-emerald-400 font-bold">99.9%</p>
                  </div>
                  <div className="bg-card/60 rounded p-2">
                    <p className="text-muted-foreground">Accuracy</p>
                    <p className="text-cyan-400 font-bold">94.5%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Auto-Fix Success Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Auto-Fix Success Trend (Last 7 Days)
              </CardTitle>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Success</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Failed</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-2">
              {[85, 88, 92, 89, 91, 94, 91].map((value, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col-reverse gap-0.5">
                    <div
                      className="bg-emerald-500/80 rounded-t"
                      style={{ height: `${value}px` }}
                    />
                    <div
                      className="bg-red-500/80 rounded-t"
                      style={{ height: `${100 - value}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* User Frustration Index & SLA Predictor */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                User Frustration Index (AI-Calculated)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Current Level</span>
                    <span className="text-sm font-bold text-emerald-400">Low (2.3/10)</span>
                  </div>
                  <div className="h-3 bg-card/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                      style={{ width: '23%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                    <span>Happy</span>
                    <span>Neutral</span>
                    <span>Frustrated</span>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Gauge className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                SLA Breach Predictor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                  <span className="text-xs text-muted-foreground">On Track</span>
                  <span className="text-xs font-bold text-emerald-400">8 issues</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <span className="text-xs text-muted-foreground">At Risk (30min)</span>
                  <span className="text-xs font-bold text-amber-400">2 issues</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                  <span className="text-xs text-muted-foreground">Breaching Soon</span>
                  <span className="text-xs font-bold text-red-400">0 issues</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
