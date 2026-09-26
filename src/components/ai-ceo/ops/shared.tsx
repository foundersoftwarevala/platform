import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The furniture the operational screens share.
 *
 * These screens are lists with a row of counts above them, and they all have
 * the same three problems to solve: a figure nobody has measured, a table the
 * reader needs named, and a severity word that should be coloured without
 * inventing a scale. Solving those once here is what keeps seven screens
 * looking like each other.
 *
 * Every colour resolves through the project's own design tokens — the same
 * accent-emerald / accent-amber / destructive set the rest of the consoles
 * use — so these screens sit inside the existing theme rather than beside it.
 */

/** A count with its source named underneath. `null` renders a dash, never a zero. */
export function OpsTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const { t } = useTranslation();
  const tones: Record<string, string> = {
    default: "text-primary bg-primary/15",
    success: "text-accent-emerald bg-accent-emerald/15",
    warning: "text-accent-amber bg-accent-amber/15",
    danger: "text-destructive bg-destructive/15",
  };

  return (
    <div className="bento-card card3d p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">
            {value === null || value === "" ? (
              <span className="text-muted-foreground" title={t("ceo.not_measured")}>
                —
              </span>
            ) : typeof value === "number" ? (
              value.toLocaleString()
            ) : (
              value
            )}
          </p>
        </div>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {hint && <p className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Which table a list came from.
 *
 * Shown on every operational screen because an empty list is only meaningful
 * once the reader knows what was asked. "No agents" and "ai_agents holds no
 * rows" are the same fact, but only the second one can be acted on.
 */
export function SourceNote({ source, count }: { source?: string; count: number }) {
  const { t } = useTranslation();
  if (!source) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="tabular-nums">{count.toLocaleString()}</span> {t("ceo.shown_read_from")}{" "}
      <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px]">{source}</code>
    </p>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-accent-amber/20 text-accent-amber border-accent-amber/30",
  warning: "bg-accent-amber/20 text-accent-amber border-accent-amber/30",
  low: "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30",
  info: "bg-primary/20 text-primary border-primary/30",
};

/** A severity or status word, coloured only where the word is one we know. */
export function ToneBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = SEVERITY_TONE[value.toLowerCase()];
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", tone ?? "border-border text-muted-foreground")}
    >
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

/** A horizontally scrolling table that does not squash on a phone. */
export function OpsTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="bento-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {head.map((cell) => (
                <th
                  key={cell}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A figure that may never have been measured. */
export function Figure({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/** A date rendered as a plain day, or a dash where there is none. */
export function Day({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return <span className="font-mono text-xs">{value}</span>;
  return <span className="font-mono text-xs">{at.toISOString().slice(0, 10)}</span>;
}
