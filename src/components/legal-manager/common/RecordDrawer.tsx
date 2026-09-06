import { Fragment } from "react";
import { Clock, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AsyncState } from "./AsyncState";
import { useLegalLogs, type LegalRecord } from "@/lib/legal-data";

const HIDDEN_KEYS = new Set(["id", "position", "created_at", "updated_at", "category", "details"]);

const labelise = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

const renderValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

interface RecordDrawerProps {
  record: LegalRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  actions?: React.ReactNode;
}

/** Detail drawer with full field breakdown plus the record's real audit timeline. */
export const RecordDrawer = ({
  record,
  open,
  onOpenChange,
  title,
  actions,
}: RecordDrawerProps) => {
  const { data: logs = [], isLoading, isError, error, refetch } = useLegalLogs();

  const needle = record ? (record.ref_code ?? record.name) : null;
  const related = needle
    ? logs.filter((log) =>
        `${log.details ?? ""} ${log.ref_code ?? ""}`.toLowerCase().includes(String(needle).toLowerCase()),
      )
    : [];

  const entries = record
    ? Object.entries(record).filter(([key]) => !HIDDEN_KEYS.has(key))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden border-border bg-card p-0 sm:max-w-xl">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-6">
            <SheetHeader className="space-y-2 text-left">
              <SheetTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                {title ?? record?.name ?? "Record details"}
              </SheetTitle>
              <SheetDescription>
                {record?.ref_code ? `Reference ${record.ref_code}` : "Live record from the legal workspace"}
              </SheetDescription>
            </SheetHeader>

            {record && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {entries.map(([key, value]) => (
                    <div
                      key={key}
                      className="min-w-0 rounded-lg border border-border bg-surface/40 p-3"
                    >
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {labelise(key)}
                      </p>
                      <div className="mt-1 break-words text-sm text-foreground">
                        {key === "status" ? (
                          <Badge variant="outline">{renderValue(value)}</Badge>
                        ) : (
                          renderValue(value)
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {actions && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-2">{actions}</div>
                  </>
                )}

                <Separator />

                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                    Status timeline
                  </h3>
                  <AsyncState
                    isLoading={isLoading}
                    isError={isError}
                    error={error as { message?: string } | null}
                    isEmpty={related.length === 0}
                    onRetry={() => void refetch()}
                    rows={2}
                    emptyTitle="No recorded activity"
                    emptyDescription="Actions taken on this record will be written to the immutable audit trail and shown here."
                  >
                    <ol className="relative space-y-4 border-l border-border pl-5">
                      {related.map((log) => (
                        <li key={log.id} className="relative">
                          <span
                            className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                          <p className="text-sm font-medium text-foreground">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{log.details}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {new Date(log.logged_at).toLocaleString()} · {log.actor}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </AsyncState>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export const RecordDrawerFragment = Fragment;
export default RecordDrawer;
