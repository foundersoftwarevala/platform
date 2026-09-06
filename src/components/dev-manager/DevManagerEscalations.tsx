import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Clock, User, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmAction, InfoHint } from '@/components/dev-manager/ui-helpers';
import { useDeliveryOverview, useUpdateEscalation } from '@/hooks/useDevManagerData';
import type { EscalationDTO } from '@/lib/dev-manager.types';

const getStatusConfig = (status: EscalationDTO['status']) => {
  switch (status) {
    case 'pending':
      return { color: 'bg-amber-500/20 text-amber-400', icon: Clock };
    case 'acknowledged':
      return { color: 'bg-blue-500/20 text-blue-400', icon: User };
    case 'resolved':
      return { color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle };
    default:
      return { color: 'bg-red-500/20 text-red-400', icon: XCircle };
  }
};

export default function DevManagerEscalations() {
  const { data, isLoading, error } = useDeliveryOverview();
  const update = useUpdateEscalation();
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const escalations = data?.escalations ?? [];
  const pendingCount = escalations.filter(e => e.status === 'pending').length;
  const acknowledgedCount = escalations.filter(e => e.status === 'acknowledged').length;

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            ESCALATIONS
            <InfoHint text="Escalations route to the area manager. Acknowledge to take ownership, then resolve with a note of at least 5 characters." />
          </CardTitle>
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400">{pendingCount} Pending</Badge>
            )}
            {acknowledgedCount > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400">{acknowledgedCount} In Progress</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground font-mono">Loading escalations…</p>}
        {error && (
          <p className="text-sm text-red-400 font-mono">
            {error instanceof Error ? error.message : 'Failed to load escalations'}
          </p>
        )}
        {escalations.map((escalation, idx) => {
          const statusConfig = getStatusConfig(escalation.status);
          const StatusIcon = statusConfig.icon;

          return (
            <motion.div
              key={escalation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 bg-muted/40 rounded-lg border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{escalation.shortId}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-xs">{escalation.taskCode}</span>
                  {escalation.autoEscalated && (
                    <Badge variant="outline" className="text-[10px]">AUTO</Badge>
                  )}
                </div>
                <Badge className={`text-xs ${statusConfig.color}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {escalation.status.toUpperCase()}
                </Badge>
              </div>

              <p className="text-sm mb-3">{escalation.reason}</p>

              <ol className="mb-3 space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Raised</span> ·{' '}
                  {new Date(escalation.escalatedAt).toLocaleString()}
                  {escalation.autoEscalated ? ' (automatic)' : ''}
                </li>
                {escalation.status !== 'pending' && (
                  <li>
                    <span className="font-medium text-foreground">Acknowledged</span> · owner{' '}
                    {escalation.escalatedTo}
                  </li>
                )}
                {escalation.status === 'resolved' && (
                  <li>
                    <span className="font-medium text-foreground">Resolved</span>
                    {escalation.resolvedAt ? ` · ${new Date(escalation.resolvedAt).toLocaleString()}` : ''}
                  </li>
                )}
              </ol>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="font-mono">{escalation.escalatedTo}</span>
                </div>
                <span>{new Date(escalation.escalatedAt).toLocaleString()}</span>
              </div>

              {escalation.status === 'pending' && (
                <ConfirmAction
                  title="Acknowledge escalation?"
                  description={`You will be recorded as the owner of ${escalation.shortId} in the audit trail.`}
                  confirmLabel="Acknowledge"
                  onConfirm={() =>
                    update.mutate({
                      escalationId: escalation.id,
                      status: 'acknowledged',
                      resolution: null,
                    })
                  }
                >
                  <Button size="sm" variant="outline" className="mt-3 w-full" disabled={update.isPending}>
                    {update.isPending ? 'Saving…' : 'Acknowledge'}
                  </Button>
                </ConfirmAction>
              )}

              {escalation.status === 'acknowledged' && (
                <div className="mt-3 space-y-1">
                  <div className="flex gap-2">
                    <Input
                      id={`resolution-${escalation.id}`}
                      value={resolutions[escalation.id] ?? ''}
                      onChange={(e) =>
                        setResolutions((prev) => ({ ...prev, [escalation.id]: e.target.value }))
                      }
                      placeholder="Resolution note (required, min 5 chars)…"
                      aria-label={`Resolution note for ${escalation.shortId}`}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={
                        update.isPending || (resolutions[escalation.id]?.trim().length ?? 0) < 5
                      }
                      onClick={() =>
                        update.mutate({
                          escalationId: escalation.id,
                          status: 'resolved',
                          resolution: resolutions[escalation.id]?.trim() ?? null,
                        })
                      }
                    >
                      {update.isPending ? 'Saving…' : 'Resolve'}
                    </Button>
                  </div>
                  {(resolutions[escalation.id]?.trim().length ?? 0) > 0 &&
                    (resolutions[escalation.id]?.trim().length ?? 0) < 5 && (
                      <p className="text-xs text-destructive">
                        Resolution needs at least 5 characters for the audit trail.
                      </p>
                    )}
                </div>
              )}

              {escalation.resolution && (
                <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  <p className="text-xs text-emerald-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    {escalation.resolution}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}

        {!isLoading && !error && escalations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mx-auto mb-3 w-fit rounded-full bg-emerald-500/10 p-4">
              <AlertTriangle className="h-10 w-10 text-emerald-400" />
            </div>
            <p className="text-base font-medium text-foreground">No escalations</p>
            <p className="mt-1 text-sm">Nothing has breached its threshold or been raised manually.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
