/**
 * Internal Support AI - Auto Issue Detection
 * Real-time context capture, error listeners, failure trackers
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Radar,
  Eye,
  AlertTriangle,
  MousePointer,
  Zap,
  Lock,
  RefreshCw,
  Wifi,
  Activity,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface AutoIssueDetectionProps {
  activeView: string;
}

interface DetectionEvent {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  context: string;
  autoResolved: boolean;
}

export const AutoIssueDetection: React.FC<AutoIssueDetectionProps> = ({ activeView }) => {
  const [events, setEvents] = useState<DetectionEvent[]>([
    { id: 'DET-001', type: 'API Optimization', severity: 'high', timestamp: '12:45:32', context: '/api/users/profile', autoResolved: true },
    { id: 'DET-002', type: 'Button Processing', severity: 'medium', timestamp: '12:44:18', context: 'Submit Button - Dashboard', autoResolved: true },
    { id: 'DET-003', type: 'Access Configuration', severity: 'high', timestamp: '12:43:55', context: 'Access /admin/settings', autoResolved: false },
    { id: 'DET-004', type: 'Network Optimization', severity: 'low', timestamp: '12:42:10', context: '> 2000ms response', autoResolved: true },
    { id: 'DET-005', type: 'System Alignment', severity: 'medium', timestamp: '12:40:45', context: 'Type Configuration', autoResolved: true }
  ]);

  const [detectionStats, setDetectionStats] = useState({
    totalDetected: 156,
    autoResolved: 142,
    pendingReview: 8,
    escalated: 6,
    avgDetectionTime: 45
  });

  const detectorTypes = [
    { id: 'context', label: 'Context Capture', icon: <Eye className="w-4 h-4" />, status: 'active', events: 89 },
    { id: 'error', label: 'Silent Error Listener', icon: <AlertTriangle className="w-4 h-4" />, status: 'active', events: 23 },
    { id: 'click', label: 'Click-Failure Tracker', icon: <MousePointer className="w-4 h-4" />, status: 'active', events: 12 },
    { id: 'api', label: 'API Failure Detector', icon: <Zap className="w-4 h-4" />, status: 'active', events: 18 },
    { id: 'permission', label: 'Permission Mismatch', icon: <Lock className="w-4 h-4" />, status: 'active', events: 5 },
    { id: 'session', label: 'Session Corruption', icon: <RefreshCw className="w-4 h-4" />, status: 'active', events: 3 },
    { id: 'network', label: 'Network / Latency', icon: <Wifi className="w-4 h-4" />, status: 'active', events: 6 }
  ];

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-muted/40 text-muted-foreground border-border';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Detection Stats */}
      <div className="grid grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <Radar className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{detectionStats.totalDetected}</p>
              <p className="text-[10px] text-muted-foreground">Total Detected</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{detectionStats.autoResolved}</p>
              <p className="text-[10px] text-muted-foreground">Auto-Resolved</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{detectionStats.pendingReview}</p>
              <p className="text-[10px] text-muted-foreground">Pending Review</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/20">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-400">{detectionStats.escalated}</p>
              <p className="text-[10px] text-muted-foreground">Escalated</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{detectionStats.avgDetectionTime}ms</p>
              <p className="text-[10px] text-muted-foreground">Avg Detection</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detector Status Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Radar className="w-4 h-4 text-cyan-400 animate-pulse" />
              Active Detectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {detectorTypes.map((detector) => (
                <div
                  key={detector.id}
                  className="p-3 bg-card/60 rounded-lg border border-border hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      {detector.icon}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-emerald-400">ACTIVE</span>
                    </div>
                  </div>
                  <p className="text-xs text-foreground font-medium">{detector.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{detector.events} events today</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Real-time Detection Feed */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Real-time Detection Feed
              </CardTitle>
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1" />
                LIVE
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">{event.timestamp}</span>
                    <Badge className={`${getSeverityBadge(event.severity)} border text-[9px]`}>
                      {event.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-foreground">{event.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground max-w-48 truncate">{event.context}</span>
                    {event.autoResolved ? (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[9px]">AUTO-RESOLVED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px]">PENDING</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
