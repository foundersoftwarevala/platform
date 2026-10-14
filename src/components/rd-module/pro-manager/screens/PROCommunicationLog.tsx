import { Button } from "@/components/rd-module/ui/button";
import { usePMCommunicationsPaged } from "@/hooks/rd-module/useProManagerData";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, formatDate } from "../pm-ui";

export const PROCommunicationLog = ({ search = "" }: { search?: string }) => {
  const { rows, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePMCommunicationsPaged();
  const term = search.trim().toLowerCase();
  const logs = rows.filter((row) =>
    term
      ? [row.code, row.type, row.user_code, row.content].join(" ").toLowerCase().includes(term)
      : true,
  );

  return (
    <PMSection
      title="Communication log"
      description="Every chat, email, call and AI exchange with premium accounts, recorded for governance."
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={5} />
        ) : logs.length === 0 ? (
          <PMEmpty message="No communication entries match this search." />
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-foreground">{log.content}</p>
                  <PMBadge tone="muted">{log.type}</PMBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.code} • {log.user_code} • {formatDate(log.created_at)}
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
