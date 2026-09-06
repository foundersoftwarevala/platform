import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditLogs, useLogAction } from "@/hooks/usePromiseTracker";
import {
  AUDIT_LOG_EXPORT_COLUMNS,
  downloadCsv,
  formatDateTime,
} from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — Promise Tracker" },
      {
        name: "description",
        content:
          "Immutable trail of every promise action in Software Vala: creations, status changes, escalations, fines, tips and settings updates.",
      },
      { property: "og:title", content: "Audit Logs — Promise Tracker" },
      {
        property: "og:description",
        content: "Immutable trail of every action taken in the promise register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTAuditLogs,
});

function PTAuditLogs() {
  const { data = [] } = useAuditLogs();
  const logAction = useLogAction();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");

  const actionTypes = Array.from(new Set(data.map((log) => log.action))).sort();

  const rows = data.filter(
    (log) =>
      (action === "all" || log.action === action) &&
      [log.action, log.promise_code, log.actor, log.details]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <PTPageHeader
        title="Audit Logs"
        description="Every action taken inside the Promise Tracker is recorded with actor, role and timestamp."
        actions={
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => {
              downloadCsv(
                `promise-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                rows.map((log) => ({
                  timestamp: log.created_at,
                  action: log.action,
                  promise_code: log.promise_code ?? "",
                  actor: log.actor,
                  actor_role: log.actor_role,
                  details: log.details,
                })),
                AUDIT_LOG_EXPORT_COLUMNS,
              );
              logAction.mutate({
                action: "Data Exported",
                details: `${rows.length} audit log entries exported to CSV`,
              });
            }}
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action, promise code, actor or details"
          className="max-w-md"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-56" aria-label="Filter by action type">
            <SelectValue placeholder="All action types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All action types</SelectItem>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} entries</span>
      </div>

      <div className="glass-panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Promise</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </TableCell>
                <TableCell className="text-sm font-medium">{log.action}</TableCell>
                <TableCell className="mono text-xs text-muted-foreground">
                  {log.promise_code ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  <p>{log.actor}</p>
                  <p className="text-xs text-muted-foreground">{log.actor_role}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No log entries match this search.</p>
        ) : null}
      </div>
    </div>
  );
}
