/**
 * Internal Support AI — status strip.
 * Restores the metrics that used to live in the module top bar
 * (system status, live SLA timer, pending issues, auto-fix rate,
 * escalation queue, AI health and the security indicators).
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Heart,
  Lock,
  Shield,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SystemStatus } from './types';

interface AIStatusStripProps {
  systemStatus?: SystemStatus;
  pendingIssues?: number;
  autoFixSuccessRate?: number;
  escalationQueue?: number;
  userRole?: string;
}

const statusTone: Record<SystemStatus, string> = {
  LIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DEGRADED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  OFFLINE: 'bg-destructive/15 text-destructive border-destructive/30',
};

const statusDot: Record<SystemStatus, string> = {
  LIVE: 'bg-emerald-500',
  DEGRADED: 'bg-amber-500',
  OFFLINE: 'bg-destructive',
};

const Metric = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
    {icon}
    <span>{label}</span>
    <span className={tone}>{value}</span>
  </div>
);

export const AIStatusStrip: React.FC<AIStatusStripProps> = ({
  systemStatus = 'LIVE',
  pendingIssues = 12,
  autoFixSuccessRate = 91.3,
  escalationQueue = 3,
  userRole = 'SUPER_ADMIN',
}) => {
  const [slaSeconds, setSlaSeconds] = useState(45 * 60 + 32);

  useEffect(() => {
    const id = setInterval(() => setSlaSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = Math.floor(slaSeconds / 3600);
  const mm = Math.floor((slaSeconds % 3600) / 60);
  const ss = slaSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const slaTimer = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  const slaCritical = slaSeconds < 600;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-xl">
      <span className="inline-flex items-center gap-2">
        <span className={`h-2 w-2 animate-pulse rounded-full ${statusDot[systemStatus]}`} />
        <Badge className={`${statusTone[systemStatus]} border text-[10px]`}>{systemStatus}</Badge>
        <span className="text-[11px] text-muted-foreground">Internal Support AI</span>
      </span>

      <Metric
        icon={<Clock className="h-3 w-3 text-primary" />}
        label="SLA"
        value={slaTimer}
        tone={`font-mono font-bold ${slaCritical ? 'text-destructive' : 'text-primary'}`}
      />
      <Metric
        icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}
        label="Pending"
        value={String(pendingIssues)}
        tone="font-bold text-amber-400"
      />
      <Metric
        icon={<CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        label="Auto-Fix"
        value={`${autoFixSuccessRate}%`}
        tone="font-bold text-emerald-400"
      />
      <Metric
        icon={<Zap className="h-3 w-3 text-primary" />}
        label="Escalations"
        value={String(escalationQueue)}
        tone="font-bold text-foreground"
      />
      <Metric
        icon={<Heart className="h-3 w-3 text-rose-400" />}
        label="AI Health"
        value="98.5%"
        tone="font-bold text-emerald-400"
      />

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Globe className="h-3 w-3" />
          Auto-detect
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 text-emerald-400" />
          Encrypted
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1.5 text-[11px] font-medium text-foreground">
          <Shield className="h-3 w-3 text-primary" />
          {userRole.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};

export default AIStatusStrip;
