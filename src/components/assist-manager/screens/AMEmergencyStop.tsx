/**
 * EMERGENCY STOP
 * Instant kill switch — single session or every live session.
 */

import { useState } from "react";
import { AlertTriangle, Ban, OctagonX, Power, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEmergencyStops, useEndSession, useLiveSessions, useStopAll } from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  RiskPill,
  ScreenHeader,
  formatDuration,
  timeAgo,
  titleCase,
} from "../am-ui";

export function AMEmergencyStop() {
  const { data: live = [], isLoading } = useLiveSessions();
  const { data: stops = [] } = useEmergencyStops();
  const stopAll = useStopAll();
  const endSession = useEndSession();

  const [reason, setReason] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);

  const stopReason = () => (reason.trim() ? reason.trim() : "Emergency stop by Assist Manager");

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Emergency Stop"
          subtitle="Instant kill switch for any assist session"
          tone="danger"
          actions={
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="h-4 w-4" />
              Critical Control
            </Badge>
          }
        />

        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
                <Power className="h-10 w-10 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">Force Stop All Sessions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Immediately terminate every live session. All access is revoked instantly.
                </p>
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for stop (recorded in the audit trail)"
                className="max-w-md"
              />
              <Button
                size="lg"
                variant="destructive"
                disabled={live.length === 0 || stopAll.isPending}
                onClick={() => setConfirmAll(true)}
              >
                <OctagonX className="mr-2 h-5 w-5" />
                Stop All Sessions ({live.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5" />
              Live Sessions
              <Badge variant="secondary" className="ml-1">
                {live.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingBlock rows={3} />
            ) : live.length === 0 ? (
              <EmptyState
                title="No live sessions"
                description="There is nothing to stop right now."
              />
            ) : (
              <div className="space-y-3">
                {live.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CodeChip>{session.session_code}</CodeChip>
                          <RiskPill risk={session.risk_level} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.end_user?.user_code ?? "—"} ·{" "}
                          {session.agent?.agent_code ?? "Unassigned"} ·{" "}
                          {titleCase(session.access_mode)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatDuration(session.started_at)}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={endSession.isPending}
                        onClick={() =>
                          endSession.mutate({
                            id: session.id,
                            reason: stopReason(),
                            emergency: true,
                          })
                        }
                      >
                        <Ban className="mr-1 h-4 w-4" />
                        Force Stop
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Emergency Stops</CardTitle>
          </CardHeader>
          <CardContent>
            {stops.length === 0 ? (
              <EmptyState
                title="No emergency stops recorded"
                description="Every forced termination is logged here permanently."
              />
            ) : (
              <div className="space-y-3">
                {stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <OctagonX className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CodeChip>{stop.session_code}</CodeChip>
                          <Badge variant="outline" className="text-xs">
                            {titleCase(stop.stop_type)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stop.reason} · stopped by {stop.stopped_by}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(stop.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">Emergency Stop Behaviour</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A stop is instant and irreversible. Sessions are terminated, all permissions are
                  revoked, transferred files are removed, and the event is written to the immutable
                  audit trail.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop all {live.length} live sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              Every active, paused and pending session will be terminated immediately. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                stopAll.mutate(stopReason());
                setReason("");
              }}
            >
              Stop All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

export default AMEmergencyStop;
