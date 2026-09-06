/**
 * ACTIVE SESSIONS
 * Live session monitoring with pause / resume / end actions.
 */

import { Clock, Eye, MonitorPlay, Pause, Play, Shield, Square, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useAgents,
  useEndSession,
  usePauseResume,
  usePrivacyControls,
  useSessions,
} from "@/lib/assist-manager/hooks";
import {
  ACCESS_MODE_LABEL,
  CodeChip,
  EmptyState,
  LoadingBlock,
  RiskPill,
  ScreenHeader,
  StatCard,
  StatusPill,
  formatDuration,
  titleCase,
} from "../am-ui";
import { useAM } from "../am-context";

export function AMActiveSessions() {
  const { openSession } = useAM();
  const { data: sessions = [], isLoading } = useSessions();
  const { data: agents = [] } = useAgents();
  const { data: privacy = [] } = usePrivacyControls();
  const pauseResume = usePauseResume();
  const endSession = useEndSession();

  const live = sessions.filter((s) => s.status === "active" || s.status === "paused");
  const agentsOnline = agents.filter((a) => a.status !== "offline").length;
  const secure = privacy.length
    ? Math.round((privacy.filter((p) => p.enabled).length / privacy.length) * 100)
    : 100;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Active Sessions"
          subtitle="Currently live assist connections"
          actions={
            <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              {live.length} Live
            </span>
          }
        />

        {isLoading ? (
          <LoadingBlock />
        ) : live.length === 0 ? (
          <EmptyState
            title="No live sessions"
            description="Approved sessions appear here while they are running."
          />
        ) : (
          <div className="space-y-4">
            {live.map((session) => (
              <Card
                key={session.id}
                className={cn(
                  "border-l-4",
                  session.status === "paused" ? "border-l-warning" : "border-l-success",
                )}
              >
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
                    <Field label="Session ID">
                      <CodeChip>{session.session_code}</CodeChip>
                    </Field>
                    <Field label="User (Masked)">
                      <span className="code-chip text-sm">{session.end_user?.user_code ?? "—"}</span>
                    </Field>
                    <Field label="Agent (Masked)">
                      <span className="code-chip text-sm">{session.agent?.agent_code ?? "—"}</span>
                    </Field>
                    <Field label="Type">
                      <span className="text-sm">{titleCase(session.assist_type)}</span>
                    </Field>
                    <Field label="Mode">
                      <span className="text-sm">
                        {ACCESS_MODE_LABEL[session.access_mode] ?? titleCase(session.access_mode)}
                      </span>
                    </Field>
                    <Field label="Duration">
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="code-chip">{formatDuration(session.started_at)}</span>
                      </span>
                    </Field>
                    <Field label="AI Score">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          session.ai_score >= 90
                            ? "text-success"
                            : session.ai_score >= 70
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {session.ai_score}%
                      </span>
                    </Field>
                    <Field label="Status / Risk">
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusPill status={session.status} />
                        <RiskPill risk={session.risk_level} />
                      </span>
                    </Field>
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Permissions
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {session.permissions.map((p) => (
                          <CodeChip key={p}>{p.replace(/_/g, " ")}</CodeChip>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                    <Button size="sm" variant="outline" onClick={() => openSession(session.id)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pauseResume.isPending}
                      onClick={() =>
                        pauseResume.mutate({
                          id: session.id,
                          pause: session.status === "active",
                        })
                      }
                    >
                      {session.status === "paused" ? (
                        <>
                          <Play className="mr-1 h-4 w-4" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-1 h-4 w-4" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={endSession.isPending}
                      onClick={() =>
                        endSession.mutate({
                          id: session.id,
                          reason: "Ended by Assist Manager",
                        })
                      }
                    >
                      <Square className="mr-1 h-4 w-4" />
                      End
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Active now" value={live.length} icon={MonitorPlay} tone="primary" />
          <StatCard label="Agents online" value={agentsOnline} icon={User} tone="info" />
          <StatCard
            label="Privacy coverage"
            value={`${secure}%`}
            hint={`${privacy.filter((p) => p.enabled).length}/${privacy.length} controls enabled`}
            icon={Shield}
            tone="success"
          />
        </div>
      </div>
    </ScrollArea>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default AMActiveSessions;
