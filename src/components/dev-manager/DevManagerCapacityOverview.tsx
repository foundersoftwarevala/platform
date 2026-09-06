import React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDeliveryOverview } from '@/hooks/useDevManagerData';
import { InfoHint, ReadOnlyTag } from '@/components/dev-manager/ui-helpers';
import type { DeveloperCapacityDTO } from '@/lib/dev-manager.types';

const getAvailabilityColor = (availability: DeveloperCapacityDTO['availability']) => {
  switch (availability) {
    case 'available': return 'bg-emerald-500';
    case 'busy': return 'bg-amber-500';
    case 'overloaded': return 'bg-red-500';
    default: return 'bg-muted-foreground';
  }
};

const getCapacityColor = (active: number, max: number) => {
  const ratio = max > 0 ? active / max : 0;
  if (ratio >= 1) return 'text-red-400';
  if (ratio >= 0.8) return 'text-amber-400';
  return 'text-emerald-400';
};

export default function DevManagerCapacityOverview() {
  const { data, isLoading, error } = useDeliveryOverview();
  const developers = data?.developers ?? [];

  const totalDevelopers = developers.length;
  const availableCount = developers.filter(d => d.availability === 'available').length;
  const overloadedCount = developers.filter(d => d.availability === 'overloaded').length;
  const totalOverdue = developers.reduce((sum, d) => sum + d.overdueCount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold">{totalDevelopers}</p>
                <p className="text-xs text-muted-foreground">Total Devs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold">{availableCount}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold">{overloadedCount}</p>
                <p className="text-xs text-muted-foreground">Overloaded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold">{totalOverdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Developer List */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-mono tracking-wider text-muted-foreground">
            DEVELOPER CAPACITY
            <InfoHint text="Occupancy is active tasks against the developer's configured maximum capacity. Amber from 80%, red at or over 100%." />
          </CardTitle>
          <div className="pt-1">
            <ReadOnlyTag note="capacity is derived from live task data" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground font-mono">Loading live capacity…</p>
          )}
          {error && (
            <p className="text-sm text-red-400 font-mono">
              {error instanceof Error ? error.message : 'Failed to load capacity'}
            </p>
          )}
          {developers.map((dev, idx) => (
            <motion.div
              key={dev.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-3 bg-muted/40 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getAvailabilityColor(dev.availability)}`} />
                  <span className="font-mono text-sm">{dev.valaId}</span>
                  <span className="text-xs text-muted-foreground">{dev.fullName}</span>
                  {dev.overdueCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                      {dev.overdueCount} overdue
                    </span>
                  )}
                </div>
                <span
                  className={`font-mono text-sm tabular-nums ${getCapacityColor(dev.activeTasks, dev.maxCapacity)}`}
                >
                  {dev.activeTasks}/{dev.maxCapacity} tasks ·{' '}
                  {dev.maxCapacity > 0
                    ? Math.round((dev.activeTasks / dev.maxCapacity) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={dev.maxCapacity > 0 ? (dev.activeTasks / dev.maxCapacity) * 100 : 0}
                className="h-1.5"
                aria-label={`${dev.valaId} capacity: ${dev.activeTasks} of ${dev.maxCapacity} tasks`}
              />
              <div className="flex gap-1 mt-2 flex-wrap">
                {dev.skillTags.map(skill => (
                  <span key={skill} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
          {!isLoading && !error && developers.length === 0 && (
            <p className="text-sm text-muted-foreground">No developers registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
