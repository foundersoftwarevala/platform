import { AlertOctagon, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  StatCard,
  when,
} from "@/components/manager/primitives";
import { useRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";

const TONE: Record<string, string> = {
  critical: "border-status-error/40 text-status-error",
  error: "border-status-error/40 text-status-error",
  warning: "border-status-warning/40 text-status-warning",
};

/** Live production error monitoring: server actions, SSR and browser errors. */
export default function ErrorMonitorPanel() {
  const query = useRecords({
    table: "error_events",
    orderBy: "occurred_at",
    ascending: false,
    limit: 200,
  });
  const resolve = useUpdateRecord("Error marked resolved");

  if (query.isLoading) return <LoadingBlock />;
  if (query.error) return <ErrorState error={query.error} />;

  const rows = (query.data ?? []) as Row[];
  const open = rows.filter((r) => !r['resolved']);
  const serverFn = open.filter((r) => r['source'] === "server_fn");
  const client = open.filter((r) => r['source'] === "client");
  const ssr = open.filter((r) => r['source'] === "ssr");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unresolved Errors" value={open.length} icon={<AlertOctagon className="h-4 w-4" />} tone="red" />
        <StatCard label="Server Actions" value={serverFn.length} icon={<AlertOctagon className="h-4 w-4" />} tone="amber" />
        <StatCard label="Browser Console" value={client.length} icon={<AlertOctagon className="h-4 w-4" />} tone="cyan" />
        <StatCard label="SSR / Requests" value={ssr.length} icon={<AlertOctagon className="h-4 w-4" />} tone="violet" />
      </div>

      <GlassCard
        title="Runtime Error Monitoring"
        icon={<AlertOctagon className="h-4 w-4 text-primary" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        {rows.length === 0 ? (
          <EmptyState message="No runtime errors recorded. Monitoring is active." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Route / Function</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((row) => (
                  <TableRow key={String(row['id'])} className={row['resolved'] ? "opacity-50" : ""}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {when(row['occurred_at'] as string)}
                    </TableCell>
                    <TableCell className="text-xs">{String(row['source'])}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TONE[String(row['severity'])] ?? ""}>
                        {String(row['severity'])}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs" title={String(row['message'])}>
                      {String(row['message'])}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {String(row['fn_name'] ?? row['route'] ?? "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {row['resolved'] ? (
                        <span className="text-xs text-muted-foreground">Resolved</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            resolve.mutate({
                              table: "error_events",
                              id: String(row['id']),
                              values: { resolved: true },
                            })
                          }
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
