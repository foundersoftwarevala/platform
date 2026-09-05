/**
 * Internal Support AI - Auto-Fix Engine
 * Safe Fix Queue, Config Re-sync, Permission Rebind, Rollback
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Wrench,
  CheckCircle2,
  RefreshCw,
  Lock,
  Database,
  Wifi,
  Zap,
  RotateCcw,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface AutoFixEngineProps {
  activeView: string;
}

interface FixAction {
  id: string;
  type: string;
  description: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  issueId: string;
  startedAt: string | null;
  completedAt: string | null;
  rollbackAvailable: boolean;
}

export const AutoFixEngine: React.FC<AutoFixEngineProps> = ({ activeView }) => {
  const [fixQueue, setFixQueue] = useState<FixAction[]>([
    { id: 'FIX-001', type: 'Config Re-sync', description: 'Syncing user preferences', status: 'running', issueId: 'ISS-024', startedAt: '12:45:00', completedAt: null, rollbackAvailable: true },
    { id: 'FIX-002', type: 'Cache Reset', description: 'Clearing stale session data', status: 'queued', issueId: 'ISS-025', startedAt: null, completedAt: null, rollbackAvailable: true },
    { id: 'FIX-003', type: 'Permission Rebind', description: 'Re-applying role permissions', status: 'queued', issueId: 'ISS-026', startedAt: null, completedAt: null, rollbackAvailable: true },
    { id: 'FIX-004', type: 'API Reconnect', description: 'Re-establishing API connection', status: 'success', issueId: 'ISS-022', startedAt: '12:40:00', completedAt: '12:40:15', rollbackAvailable: true },
    { id: 'FIX-005', type: 'State Reset', description: 'Resetting corrupted UI state', status: 'success', issueId: 'ISS-021', startedAt: '12:38:00', completedAt: '12:38:08', rollbackAvailable: true }
  ]);

  const [queuePaused, setQueuePaused] = useState(false);

  const handleToggleQueue = () => {
    setQueuePaused((prev) => {
      const next = !prev;
      toast[next ? 'warning' : 'success'](next ? 'Safe fix queue paused' : 'Safe fix queue resumed');
      return next;
    });
  };

  const handleRollback = (fix: FixAction) => {
    setFixQueue((prev) =>
      prev.map((f) =>
        f.id === fix.id
          ? { ...f, status: 'queued', startedAt: null, completedAt: null, rollbackAvailable: false }
          : f,
      ),
    );
    setEngineStats((prev) => ({ ...prev, rollbacksUsed: prev.rollbacksUsed + 1, queueDepth: prev.queueDepth + 1 }));
    toast.success(`${fix.id} rolled back — re-queued for review`);
  };

  const [engineStats, setEngineStats] = useState({
    totalFixes: 142,
    successRate: 91.3,
    avgFixTime: 8.2,
    rollbacksUsed: 3,
    queueDepth: 2
  });

  const fixTypes = [
    { id: 'safe-queue', label: 'Safe Fix Queue', icon: <CheckCircle2 className="w-4 h-4" />, count: 2, color: 'cyan' },
    { id: 'config-sync', label: 'Config Re-sync', icon: <RefreshCw className="w-4 h-4" />, count: 45, color: 'blue' },
    { id: 'permission', label: 'Permission Rebind', icon: <Lock className="w-4 h-4" />, count: 23, color: 'purple' },
    { id: 'cache', label: 'Cache / State Reset', icon: <Database className="w-4 h-4" />, count: 38, color: 'amber' },
    { id: 'api', label: 'API Reconnect', icon: <Wifi className="w-4 h-4" />, count: 19, color: 'emerald' },
    { id: 'service', label: 'Service Restart', icon: <Zap className="w-4 h-4" />, count: 8, color: 'orange' },
    { id: 'rollback', label: 'Rollback to Stable', icon: <RotateCcw className="w-4 h-4" />, count: 9, color: 'red' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'queued': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'success': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Engine Stats */}
      <div className="grid grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <Wrench className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{engineStats.totalFixes}</p>
              <p className="text-[10px] text-muted-foreground">Total Fixes</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{engineStats.successRate}%</p>
              <p className="text-[10px] text-muted-foreground">Success Rate</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{engineStats.avgFixTime}s</p>
              <p className="text-[10px] text-muted-foreground">Avg Fix Time</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-600/5 border-orange-500/20">
            <CardContent className="p-4 text-center">
              <RotateCcw className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-400">{engineStats.rollbacksUsed}</p>
              <p className="text-[10px] text-muted-foreground">Rollbacks Used</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Shield className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{engineStats.queueDepth}</p>
              <p className="text-[10px] text-muted-foreground">Queue Depth</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Fix Types Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              Fix Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {fixTypes.map((type) => (
                <div
                  key={type.id}
                  className={`p-3 bg-${type.color}-500/10 rounded-lg border border-${type.color}-500/20 text-center hover:border-${type.color}-500/40 transition-all cursor-pointer`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-${type.color}-500/20 flex items-center justify-center mx-auto mb-2 text-${type.color}-400`}>
                    {type.icon}
                  </div>
                  <p className="text-xs text-foreground font-medium">{type.count}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{type.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Fix Queue */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Safe Fix Queue
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-border"
                  onClick={handleToggleQueue}
                >
                  {queuePaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                  {queuePaused ? 'Resume Queue' : 'Pause Queue'}
                </Button>
                <Badge
                  className={`${queuePaused ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} border text-[10px]`}
                >
                  {queuePaused ? 'ENGINE PAUSED' : 'ENGINE ACTIVE'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fixQueue.map((fix, idx) => (
                <motion.div
                  key={fix.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-cyan-400">{fix.id}</span>
                    <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center">
                      {fix.status === 'running' ? (
                        <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                      ) : fix.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-foreground">{fix.type}</p>
                      <p className="text-[10px] text-muted-foreground">{fix.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">Issue: {fix.issueId}</span>
                    <Badge className={`${getStatusBadge(fix.status)} border text-[9px]`}>
                      {fix.status.toUpperCase()}
                    </Badge>
                    {fix.rollbackAvailable && fix.status === 'success' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-orange-400 hover:text-orange-300"
                        onClick={() => handleRollback(fix)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Engine Health */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Engine Health & Safety
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Safety Mode</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">ENABLED</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">All fixes are scoped and reversible</p>
              </div>
              <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Auto-Rollback</span>
                  <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px]">ACTIVE</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Automatic rollback on failure detection</p>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Stable State</span>
                  <Badge className="bg-purple-500/20 text-purple-400 text-[9px]">SAVED</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Last stable state: 2 minutes ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
