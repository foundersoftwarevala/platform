import { useMemo, useState } from "react";
import { FileText, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssistLogs, useSessions } from "@/lib/assist-manager/hooks";
import { EmptyState, LoadingBlock, ScreenHeader } from "../am-ui";

type AuditViewRow = {
  id: string;
  sessionId: string | null;
  action: string;
  actorId: string | null;
  createdAt: string;
  source: "assist_logs" | "assist_audit_logs" | "audit_logs";
  details: unknown;
};

export function AMSessionLogs() {
  const logs = useAssistLogs();
  const sessions = useSessions();
  const [term, setTerm] = useState("");

  const records = useMemo<AuditViewRow[]>(() => {
    if (!logs.data) return [];
    const rows: AuditViewRow[] = [
      ...logs.data.events.map((event) => ({
        id: `assist:${event.id}`,
        sessionId: event.session_id,
        action: event.action,
        actorId: event.actor_user_id,
        createdAt: event.created_at,
        source: "assist_logs" as const,
        details: event.details,
      })),
      ...logs.data.audit.map((event) => ({
        id: `module:${event.id}`,
        sessionId: event.session_id,
        action: event.action,
        actorId: event.actor_user_id,
        createdAt: event.created_at,
        source: "assist_audit_logs" as const,
        details: { before: event.old_state, after: event.new_state },
      })),
      ...logs.data.platformAudit.map((event) => ({
        id: `platform:${event.id}`,
        sessionId: event.entity_type === "assist_sessions" ? event.entity_id : null,
        action: event.action,
        actorId: event.actor_id,
        createdAt: event.created_at,
        source: "audit_logs" as const,
        details: { before: event.before_state, after: event.after_state },
      })),
    ];
    const query = term.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.action,
        row.actorId ?? "",
        row.sessionId ?? "",
        row.source,
        JSON.stringify(row.details),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [logs.data, term]);
  const sessionCodes = useMemo(
    () => new Map((sessions.data ?? []).map((session) => [session.id, session.session_code])),
    [sessions.data],
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Session Logs"
          subtitle="Append-only events from Assist and platform audit records"
          actions={
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Read only
            </Badge>
          }
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search event, actor, session or source..."
            className="pl-10"
          />
        </div>

        {logs.isLoading || sessions.isLoading ? (
          <LoadingBlock rows={3} />
        ) : logs.isError || sessions.isError ? (
          <Card>
            <CardContent className="p-5 text-sm text-destructive" role="alert">
              {logs.error instanceof Error
                ? logs.error.message
                : sessions.error instanceof Error
                  ? sessions.error.message
                  : "Audit records could not be loaded."}
            </CardContent>
          </Card>
        ) : records.length === 0 ? (
          <EmptyState
            title="No audit events"
            description="No Assist or platform audit records match this view."
          />
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <Card key={record.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium">{record.action}</span>
                      <Badge variant="outline">{record.source}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Session:{" "}
                      {record.sessionId
                        ? sessionCodes.get(record.sessionId) ?? record.sessionId
                        : "not attached"}
                      {" · "}Actor: {record.actorId ?? "system / unavailable"}
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs">
                      {JSON.stringify(record.details, null, 2)}
                    </pre>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(record.createdAt).toLocaleString()}
                  </time>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export default AMSessionLogs;
