/**
 * SESSION LOGS
 * Read-only audit trail sourced from assist_sessions (finished sessions are immutable).
 */

import { useMemo, useState } from "react";
import { Brain, Clock, FileText, Lock, Search, Shield, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useSessions } from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  StatusPill,
  formatClock,
  formatDuration,
  titleCase,
} from "../am-ui";

export function AMSessionLogs() {
  const { data: sessions = [], isLoading } = useSessions();
  const [term, setTerm] = useState("");

  const logs = useMemo(() => {
    const finished = sessions.filter(
      (s) => s.status === "completed" || s.status === "terminated" || s.status === "blocked",
    );
    const q = term.trim().toLowerCase();
    if (!q) return finished;
    return finished.filter((s) =>
      [
        s.session_code,
        s.end_user?.user_code ?? "",
        s.agent?.agent_code ?? "",
        s.purpose ?? "",
        s.end_reason ?? "",
        formatClock(s.started_at),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [sessions, term]);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Session Logs"
          subtitle="Read-only audit trail of all completed sessions"
          actions={
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              No Edit • No Delete
            </Badge>
          }
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search logs by session code, user, agent or reason..."
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <LoadingBlock rows={3} />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No archived sessions"
            description="Completed and terminated sessions appear here as immutable records."
          />
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="code-chip font-medium">{log.session_code}</span>
                          <StatusPill status={log.status} />
                          {log.ai_involved && (
                            <Badge variant="secondary" className="gap-1">
                              <Brain className="h-3 w-3" />
                              AI
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.purpose ?? titleCase(log.assist_type)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {formatDuration(log.started_at, log.ended_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> Participants
                      </p>
                      <div className="mt-1 space-y-1">
                        <p className="code-chip text-xs">{log.end_user?.user_code ?? "—"}</p>
                        <p className="code-chip text-xs">{log.agent?.agent_code ?? "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Start Time
                      </p>
                      <p className="mt-1 text-xs">{formatClock(log.started_at)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> End Time
                      </p>
                      <p className="mt-1 text-xs">{formatClock(log.ended_at)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" /> Permissions
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {log.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {titleCase(p)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                      {log.actions_count} actions recorded
                      {log.end_reason ? ` • ${log.end_reason}` : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Immutable record <CodeChip>{log.risk_level}</CodeChip>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-info/40 bg-info/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-info" />
              <div>
                <p className="text-sm font-medium text-info">Audit Integrity</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Finished sessions are locked by database policy — they cannot be edited or
                  deleted, guaranteeing a complete audit trail for security and compliance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMSessionLogs;
