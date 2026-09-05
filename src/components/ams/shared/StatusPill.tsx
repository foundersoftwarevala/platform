import { cn } from "@/lib/utils";
import type { AwardStatus } from "@/lib/ams/types";

const MAP: Record<AwardStatus, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "bg-muted/40 text-muted-foreground border-border" },
  pending:     { label: "Pending",     cls: "bg-warning/15 text-warning border-warning/30" },
  approved:    { label: "Approved",    cls: "bg-success/15 text-success border-success/30" },
  rejected:    { label: "Rejected",    cls: "bg-destructive/15 text-destructive border-destructive/30" },
  published:   { label: "Published",   cls: "bg-trophy/15 text-trophy border-trophy/40" },
  unpublished: { label: "Unpublished", cls: "bg-muted/40 text-muted-foreground border-border" },
  archived:    { label: "Archived",    cls: "bg-muted/30 text-muted-foreground border-border" },
  disabled:    { label: "Disabled",    cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function StatusPill({ status, className }: { status: AwardStatus; className?: string }) {
  const m = MAP[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]", m.cls, className)}>
      {m.label}
    </span>
  );
}
