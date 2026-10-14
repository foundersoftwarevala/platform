import { Download } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMAuditLogsPaged } from "@/hooks/rd-module/useProManagerData";
import { downloadCsv, useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDate } from "../pm-ui";

export const PROAuditLogs = ({ search = "" }: { search?: string }) => {
  const { rows, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePMAuditLogsPaged();
  const { exportAuditTrail, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const logs = rows.filter((row) =>
    term
      ? [row.action, row.category, row.details, row.actor, row.target, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <PMSection
      title="Audit logs"
      description="Immutable record of every Pro Manager action. Entries can be exported but never edited or deleted."
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const result = await run(
              "Audit trail exported",
              exportAuditTrail({ data: { limit: 500 } }),
            );
            if (result) downloadCsv(`pro-manager-audit-${Date.now()}.csv`, result.csv);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
        </Button>
      }
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={6} />
        ) : logs.length === 0 ? (
          <PMEmpty message="No audit entries match this search." />
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{log.action}</p>
                  <div className="flex items-center gap-1.5">
                    <PMBadge tone="muted">{log.category}</PMBadge>
                    <StatusBadge value={log.status} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{log.details}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actor} → {log.target} • {log.ip} • {formatDate(log.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {total} entries
            </p>
            {hasNextPage && (
              <Button
                size="sm"
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={fetchNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        )}
      </PMPanel>
    </PMSection>
  );
};
