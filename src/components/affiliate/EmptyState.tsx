import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick?: () => void };
  secondaryAction?: { label: string; onClick?: () => void };
}) {
  return (
    <div className="grid place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-muted text-primary">
          <Icon className="size-5" />
        </div>
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {primaryAction && (
              <Button size="sm" onClick={primaryAction.onClick}>{primaryAction.label}</Button>
            )}
            {secondaryAction && (
              <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyStateInline({ message }: { message: string }) {
  return (
    <div className="grid place-items-center px-6 py-10 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ChartEmpty({ label = "Chart will render once data is connected" }: { label?: string }) {
  return (
    <div className="grid h-full min-h-[180px] place-items-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

export function PlaceholderBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
