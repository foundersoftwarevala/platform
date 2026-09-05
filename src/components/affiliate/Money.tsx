import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatAbsolute, formatDateTime, formatMoney, formatRelative, initials, splitMoney,
  type Currency,
} from "@/lib/affiliate-format";

/**
 * Right-aligned, tabular money with de-emphasised minor units and an
 * optional sign tone. Use inside table cells and detail panels.
 */
export function Money({
  cents,
  currency = "USD",
  tone = "auto",
  className,
}: {
  cents: number | null | undefined;
  currency?: Currency;
  tone?: "auto" | "neutral" | "positive" | "negative";
  className?: string;
}) {
  const { major, minor } = splitMoney(cents, currency);
  const v = cents ?? 0;
  const resolved =
    tone === "auto" ? (v > 0 ? "neutral" : v < 0 ? "negative" : "muted") : tone;
  const toneClass =
    resolved === "positive" ? "text-success"
    : resolved === "negative" ? "text-destructive"
    : resolved === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <span
      className={["tabular-nums font-medium tracking-tight", toneClass, className ?? ""].join(" ")}
      title={formatMoney(cents, currency)}
    >
      {major}
      <span className="opacity-60">{minor}</span>
    </span>
  );
}

/** Relative timestamp with an absolute + timezone tooltip. */
export function TimeAgo({
  value,
  className,
  mode = "relative",
}: {
  value: string | Date | null | undefined;
  className?: string;
  mode?: "relative" | "absolute";
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            className={["cursor-default whitespace-nowrap tabular-nums", className ?? ""].join(" ")}
            dateTime={typeof value === "string" ? value : value.toISOString()}
          >
            {mode === "relative" ? formatRelative(value) : formatDateTime(value)}
          </time>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          {formatAbsolute(value)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Deterministic initial avatar — no external images, brand tokens only. */
export function EntityAvatar({
  name,
  size = "sm",
  className,
}: {
  name: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "xs" ? "size-6 text-[10px]"
    : size === "sm" ? "size-8 text-[11px]"
    : size === "md" ? "size-10 text-xs"
    : "size-14 text-base";
  return (
    <span
      aria-hidden="true"
      className={[
        "grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold uppercase text-primary",
        dims,
        className ?? "",
      ].join(" ")}
    >
      {initials(name)}
    </span>
  );
}
