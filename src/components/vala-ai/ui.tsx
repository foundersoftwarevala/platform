import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import type { TaskState } from "./api";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  actions?: ReactNode;
}) {
  const { translate: t } = useLanguage();
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-5 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>;
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { translate: t } = useLanguage();
  return (
    <section className={cn("rounded-xl border border-border bg-surface/60 p-4", className)}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  hint?: string;
}) {
  const { translate: t } = useLanguage();
  const toneClass = {
    default: "text-foreground",
    success: "va-text-success",
    warning: "va-text-warning",
    danger: "va-text-danger",
    info: "va-text-info",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <p className={cn("text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Loading() {
  const { translate: t } = useLanguage();
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("Loading…")}
    </div>
  );
}

export function ErrorBox({ error }: { error: { message: string } | null | undefined }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border va-border-danger va-tint-danger p-3 text-sm va-text-danger"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="whitespace-pre-wrap break-words">{error.message}</span>
    </div>
  );
}

const STATE_TONE: Record<string, string> = {
  PENDING: "border-border text-muted-foreground",
  ANALYZING: "va-border-info va-text-info",
  BUILDING: "va-border-info va-text-info",
  TESTING: "va-border-info va-text-info",
  FIXING: "va-border-warning va-text-warning",
  RETESTING: "va-border-warning va-text-warning",
  VERIFIED: "va-border-success va-text-success",
  COMPLETE: "va-border-success va-tint-success va-text-success",
  BLOCKED: "va-border-warning va-tint-warning va-text-warning",
  FAILED: "va-border-danger va-tint-danger va-text-danger",
  CANCELLED: "border-border text-muted-foreground line-through",
  pass: "va-border-success va-text-success",
  fail: "va-border-danger va-text-danger",
  unknown: "va-border-warning va-text-warning",
  UNKNOWN: "va-border-warning va-text-warning",
  draft: "border-border text-muted-foreground",
  approved: "va-border-success va-text-success",
  superseded: "border-border text-muted-foreground",
  open: "va-border-warning va-text-warning",
  rejected: "va-border-danger va-text-danger",
  pending: "va-border-warning va-text-warning",
  executed: "va-border-success va-text-success",
  failed: "va-border-danger va-text-danger",
  ready: "va-border-success va-text-success",
  creating: "va-border-info va-text-info",
  built: "va-border-success va-text-success",
  "not built": "border-border text-muted-foreground",
  "not active": "border-border text-muted-foreground",
};

export function Badge({ value, className }: { value: TaskState | string; className?: string }) {
  const { translate: t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STATE_TONE[value] ?? "border-border",
        className,
      )}
    >
      {t(value)}
    </span>
  );
}

/** Where an acceptance check ran: in the sandbox, on this machine, or refused. */
export function SandboxChip({ sandbox }: { sandbox?: string }) {
  const { translate: t } = useLanguage();
  if (!sandbox) return null;
  const [label, tone] = sandbox.startsWith("docker")
    ? [t("sandboxed"), "va-border-success va-text-success"]
    : sandbox === "refused"
      ? [t("sandbox refused"), "va-border-danger va-text-danger"]
      : [t("not sandboxed"), "va-border-warning va-text-warning"];
  return (
    <span title={sandbox} className={cn("rounded border px-1.5 text-[11px]", tone)}>
      {label}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const { translate: t } = useLanguage();
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
